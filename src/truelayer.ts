import type { Env } from "./types";

const AUTH_SCOPE = "info accounts balance offline_access";
const OAUTH_STATE_TTL_SECONDS = 600;
const OAUTH_STATE_KV_PREFIX = "truelayer_oauth_state:";
const TOKEN_KV_KEY = "truelayer_tokens";

export interface TrueLayerTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  scope?: string;
}

export interface StoredTrueLayerTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export async function createOAuthState(kv: KVNamespace): Promise<string> {
  const state = crypto.randomUUID();
  await kv.put(`${OAUTH_STATE_KV_PREFIX}${state}`, "1", {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
  });
  return state;
}

export async function consumeOAuthState(kv: KVNamespace, state: string | null): Promise<boolean> {
  if (!state) {
    return false;
  }

  const key = `${OAUTH_STATE_KV_PREFIX}${state}`;
  const exists = await kv.get(key);
  if (!exists) {
    return false;
  }

  await kv.delete(key);
  return true;
}

export function buildAuthorizationUrl(env: Env, state: string): string {
  const url = new URL(env.TRUELAYER_AUTH_BASE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.TRUELAYER_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.TRUELAYER_REDIRECT_URI);
  url.searchParams.set("scope", AUTH_SCOPE);
  url.searchParams.set("providers", env.TRUELAYER_PROVIDERS);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string, env: Env): Promise<TrueLayerTokenResponse> {
  const response = await fetch(`${env.TRUELAYER_AUTH_BASE_URL}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.TRUELAYER_CLIENT_ID,
      client_secret: env.TRUELAYER_CLIENT_SECRET,
      redirect_uri: env.TRUELAYER_REDIRECT_URI,
      code,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TrueLayer token exchange failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function storeTokens(kv: KVNamespace, tokens: TrueLayerTokenResponse): Promise<void> {
  const stored: StoredTrueLayerTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  await kv.put(TOKEN_KV_KEY, JSON.stringify(stored));
}

export async function getStoredTokens(kv: KVNamespace): Promise<StoredTrueLayerTokens | null> {
  const raw = await kv.get(TOKEN_KV_KEY);
  return raw ? (JSON.parse(raw) as StoredTrueLayerTokens) : null;
}
