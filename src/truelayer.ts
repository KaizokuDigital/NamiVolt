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

export interface TrueLayerAccount {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  provider: {
    display_name: string;
  };
}

export interface TrueLayerBalance {
  currency: string;
  available: number;
  current: number;
  overdraft?: number;
  update_timestamp: string;
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

const EXPIRY_BUFFER_MS = 60_000;

export async function refreshAccessToken(
  refreshToken: string,
  env: Env,
): Promise<TrueLayerTokenResponse> {
  const response = await fetch(`${env.TRUELAYER_AUTH_BASE_URL}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.TRUELAYER_CLIENT_ID,
      client_secret: env.TRUELAYER_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TrueLayer token refresh failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function getValidAccessToken(kv: KVNamespace, env: Env): Promise<string> {
  const stored = await getStoredTokens(kv);
  if (!stored) {
    throw new Error("No TrueLayer tokens stored — complete the /auth flow first.");
  }

  if (stored.expires_at - EXPIRY_BUFFER_MS > Date.now()) {
    return stored.access_token;
  }

  if (!stored.refresh_token) {
    throw new Error("TrueLayer access token expired and no refresh token is available.");
  }

  const refreshed = await refreshAccessToken(stored.refresh_token, env);
  await storeTokens(kv, {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? stored.refresh_token,
  });

  return refreshed.access_token;
}

export async function listAccounts(kv: KVNamespace, env: Env): Promise<TrueLayerAccount[]> {
  const accessToken = await getValidAccessToken(kv, env);

  const response = await fetch(`${env.TRUELAYER_DATA_API_BASE_URL}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TrueLayer accounts request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { results: TrueLayerAccount[] };
  return data.results;
}

export async function getAccountBalance(
  accountId: string,
  kv: KVNamespace,
  env: Env,
): Promise<TrueLayerBalance> {
  const accessToken = await getValidAccessToken(kv, env);

  const response = await fetch(
    `${env.TRUELAYER_DATA_API_BASE_URL}/data/v1/accounts/${accountId}/balance`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TrueLayer balance request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { results: TrueLayerBalance[] };
  return data.results[0];
}
