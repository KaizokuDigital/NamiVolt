/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBalanceReply } from "./balance";
import { storeTokens } from "./truelayer";
import type { Env } from "./types";

const testEnv = env as unknown as Env;
const kv = testEnv.NAMIVOLT_KV;

testEnv.TRUELAYER_AUTH_BASE_URL = "https://auth.truelayer-sandbox.com";
testEnv.TRUELAYER_DATA_API_BASE_URL = "https://api.truelayer-sandbox.com";
testEnv.TRUELAYER_CLIENT_ID = "test-client-id";
testEnv.TRUELAYER_CLIENT_SECRET = "test-client-secret";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seedValidToken() {
  await storeTokens(kv, {
    access_token: "valid-access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "Bearer",
  });
}

const transactionAccount = {
  account_id: "acc-transaction",
  account_type: "TRANSACTION",
  display_name: "Main Account",
  currency: "GBP",
  provider: { display_name: "Mock Bank" },
};

const savingsAccount = {
  account_id: "acc-savings",
  account_type: "SAVINGS",
  display_name: "Savings Account",
  currency: "GBP",
  provider: { display_name: "Mock Bank" },
};

const balance = {
  currency: "GBP",
  available: 100.5,
  current: 90.25,
  update_timestamp: "2026-07-25T12:00:00Z",
};

describe("getBalanceReply", () => {
  it("prefers the TRANSACTION account when multiple accounts exist", async () => {
    await seedValidToken();
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [savingsAccount, transactionAccount] }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ results: [balance] }), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const reply = await getBalanceReply(kv, testEnv);

    expect(reply).toContain("Main Account (Mock Bank)");
    expect(reply).toContain("Available: 100.5 GBP");
    expect(reply).toContain("Current: 90.25 GBP");
    expect(reply).toContain("As of 25 Jul 2026, 12:00 UTC");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.truelayer-sandbox.com/data/v1/accounts/acc-transaction/balance",
      expect.anything(),
    );
  });

  it("falls back to the first account when none is TRANSACTION type", async () => {
    await seedValidToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith("/data/v1/accounts")) {
          return Promise.resolve(
            new Response(JSON.stringify({ results: [savingsAccount] }), { status: 200 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ results: [balance] }), { status: 200 }),
        );
      }),
    );

    const reply = await getBalanceReply(kv, testEnv);

    expect(reply).toContain("Savings Account (Mock Bank)");
  });

  it("throws when there are no accounts", async () => {
    await seedValidToken();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );

    await expect(getBalanceReply(kv, testEnv)).rejects.toThrow(/No TrueLayer accounts found/);
  });

  it("propagates errors from the underlying TrueLayer calls", async () => {
    await kv.delete("truelayer_tokens");

    await expect(getBalanceReply(kv, testEnv)).rejects.toThrow(/No TrueLayer tokens stored/);
  });
});
