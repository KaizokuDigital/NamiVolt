/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeCodeForToken,
  getStoredTokens,
  getValidAccessToken,
  refreshAccessToken,
  storeTokens,
} from "./truelayer";
import type { Env } from "./types";

const testEnv = env as unknown as Env;
const kv = testEnv.NAMIVOLT_KV;

testEnv.TRUELAYER_AUTH_BASE_URL = "https://auth.truelayer-sandbox.com";
testEnv.TRUELAYER_CLIENT_ID = "test-client-id";
testEnv.TRUELAYER_CLIENT_SECRET = "test-client-secret";
testEnv.TRUELAYER_REDIRECT_URI = "http://localhost:8787/callback";
testEnv.TRUELAYER_PROVIDERS = "uk-cs-mock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OAuth state", () => {
  it("round-trips a valid state exactly once", async () => {
    const state = await createOAuthState(kv);

    expect(await consumeOAuthState(kv, state)).toBe(true);
    expect(await consumeOAuthState(kv, state)).toBe(false);
  });

  it("rejects an unknown state", async () => {
    expect(await consumeOAuthState(kv, "unknown-state")).toBe(false);
  });

  it("rejects a null state", async () => {
    expect(await consumeOAuthState(kv, null)).toBe(false);
  });
});

describe("buildAuthorizationUrl", () => {
  it("includes all required TrueLayer authorization params", () => {
    const url = new URL(buildAuthorizationUrl(testEnv, "abc-state"));

    expect(url.origin).toBe("https://auth.truelayer-sandbox.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8787/callback");
    expect(url.searchParams.get("providers")).toBe("uk-cs-mock");
    expect(url.searchParams.get("state")).toBe("abc-state");
  });
});

describe("exchangeCodeForToken", () => {
  it("returns the parsed token response on success", async () => {
    const tokenResponse = {
      access_token: "access-123",
      refresh_token: "refresh-123",
      expires_in: 3600,
      token_type: "Bearer",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(tokenResponse), { status: 200 })),
    );

    const result = await exchangeCodeForToken("auth-code", testEnv);

    expect(result).toEqual(tokenResponse);
  });

  it("throws when TrueLayer responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid_grant", { status: 400 })),
    );

    await expect(exchangeCodeForToken("bad-code", testEnv)).rejects.toThrow(
      /TrueLayer token exchange failed \(400\)/,
    );
  });
});

describe("token storage", () => {
  it("round-trips tokens through KV with a computed expiry", async () => {
    const before = Date.now();
    await storeTokens(kv, {
      access_token: "access-456",
      refresh_token: "refresh-456",
      expires_in: 60,
      token_type: "Bearer",
    });

    const stored = await getStoredTokens(kv);

    expect(stored?.access_token).toBe("access-456");
    expect(stored?.refresh_token).toBe("refresh-456");
    expect(stored?.expires_at).toBeGreaterThanOrEqual(before + 60 * 1000);
  });

  it("returns null when nothing is stored", async () => {
    await kv.delete("truelayer_tokens");
    expect(await getStoredTokens(kv)).toBeNull();
  });
});

describe("refreshAccessToken", () => {
  it("returns the parsed token response on success", async () => {
    const tokenResponse = {
      access_token: "refreshed-access",
      refresh_token: "refreshed-refresh",
      expires_in: 3600,
      token_type: "Bearer",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(tokenResponse), { status: 200 })),
    );

    const result = await refreshAccessToken("old-refresh-token", testEnv);

    expect(result).toEqual(tokenResponse);
  });

  it("throws when TrueLayer responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid_grant", { status: 400 })),
    );

    await expect(refreshAccessToken("bad-refresh-token", testEnv)).rejects.toThrow(
      /TrueLayer token refresh failed \(400\)/,
    );
  });
});

describe("getValidAccessToken", () => {
  it("returns the stored access token without refreshing when still valid", async () => {
    await storeTokens(kv, {
      access_token: "still-valid",
      refresh_token: "refresh-abc",
      expires_in: 3600,
      token_type: "Bearer",
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const token = await getValidAccessToken(kv, testEnv);

    expect(token).toBe("still-valid");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes and stores new tokens when the access token is expired", async () => {
    await storeTokens(kv, {
      access_token: "expired-access",
      refresh_token: "refresh-abc",
      expires_in: -10,
      token_type: "Bearer",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 },
        ),
      ),
    );

    const token = await getValidAccessToken(kv, testEnv);

    expect(token).toBe("new-access");
    const stored = await getStoredTokens(kv);
    expect(stored?.access_token).toBe("new-access");
    expect(stored?.refresh_token).toBe("new-refresh");
  });

  it("keeps the old refresh token when TrueLayer doesn't return a new one", async () => {
    await storeTokens(kv, {
      access_token: "expired-access",
      refresh_token: "refresh-original",
      expires_in: -10,
      token_type: "Bearer",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "new-access", expires_in: 3600, token_type: "Bearer" }),
          { status: 200 },
        ),
      ),
    );

    await getValidAccessToken(kv, testEnv);

    const stored = await getStoredTokens(kv);
    expect(stored?.refresh_token).toBe("refresh-original");
  });

  it("throws when no tokens are stored", async () => {
    await kv.delete("truelayer_tokens");
    await expect(getValidAccessToken(kv, testEnv)).rejects.toThrow(/No TrueLayer tokens stored/);
  });

  it("throws when expired and no refresh token is available", async () => {
    await storeTokens(kv, {
      access_token: "expired-access",
      expires_in: -10,
      token_type: "Bearer",
    });

    await expect(getValidAccessToken(kv, testEnv)).rejects.toThrow(
      /no refresh token is available/,
    );
  });
});
