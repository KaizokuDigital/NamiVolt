/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { storeTokens } from "./truelayer";
import type { Env } from "./types";

const testEnv = env as unknown as Env;

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const TEST_SECRET = "test-webhook-secret";
const AUTHORIZED_USER_ID = 111;
const UNAUTHORIZED_USER_ID = 999;

const validUpdate = {
  update_id: 1,
  message: {
    message_id: 1,
    from: { id: AUTHORIZED_USER_ID },
    chat: { id: 123 },
    text: "hi",
  },
};

async function callFetch(request: Request) {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

const TRUELAYER_SETUP_SECRET = "test-setup-secret";

beforeEach(() => {
  testEnv.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
  testEnv.AUTHORIZED_USER_IDS = String(AUTHORIZED_USER_ID);
  testEnv.TRUELAYER_SETUP_SECRET = TRUELAYER_SETUP_SECRET;
  testEnv.TRUELAYER_AUTH_BASE_URL = "https://auth.truelayer-sandbox.com";
  testEnv.TRUELAYER_CLIENT_ID = "test-client-id";
  testEnv.TRUELAYER_REDIRECT_URI = "http://localhost:8787/callback";
  testEnv.TRUELAYER_PROVIDERS = "uk-cs-mock";
  testEnv.TELEGRAM_BOT_TOKEN = "test-bot-token";
  testEnv.TRUELAYER_DATA_API_BASE_URL = "https://api.truelayer-sandbox.com";
  testEnv.TRUELAYER_CLIENT_SECRET = "test-client-secret";
});

describe("webhook endpoint", () => {
  it("returns 200 for a valid request", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify(validUpdate),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
  });

  it("returns 401 when the secret header is missing", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      body: JSON.stringify(validUpdate),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(401);
  });

  it("returns 401 when the secret header is wrong", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: "wrong-secret" },
      body: JSON.stringify(validUpdate),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid JSON body", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: "not json",
    });

    const response = await callFetch(request);

    expect(response.status).toBe(400);
  });

  it("returns 404 for GET /webhook", async () => {
    const request = new Request("https://example.com/webhook", {
      method: "GET",
      headers: { [SECRET_HEADER]: TEST_SECRET },
    });

    const response = await callFetch(request);

    expect(response.status).toBe(404);
  });

  it("returns 404 for an unknown path", async () => {
    const request = new Request("https://example.com/unknown", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify(validUpdate),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(404);
  });

  it("still acks 200 but logs a warning for an unauthorized user", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        ...validUpdate,
        message: { ...validUpdate.message, from: { id: UNAUTHORIZED_USER_ID } },
      }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({
      level: "warn",
      context: "webhook",
      message: "Unauthorized access attempt",
      userId: UNAUTHORIZED_USER_ID,
    });

    warnSpy.mockRestore();
  });
});

describe("public commands", () => {
  it("replies to /start even for an unauthorized user, and logs it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        ...validUpdate,
        message: { ...validUpdate.message, from: { id: UNAUTHORIZED_USER_ID }, text: "/start" },
      }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({
        body: expect.stringContaining("Welcome to NamiVolt"),
      }),
    );
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({
      level: "info",
      context: "webhook",
      message: "Handling public command",
      command: "/start",
      userId: UNAUTHORIZED_USER_ID,
    });

    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("replies to /help for an authorized user", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        ...validUpdate,
        message: { ...validUpdate.message, text: "/help" },
      }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("does not send a message for a non-command update from an unauthorized user", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        ...validUpdate,
        message: { ...validUpdate.message, from: { id: UNAUTHORIZED_USER_ID } },
      }),
    });

    await callFetch(request);

    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("/balance command", () => {
  const account = {
    account_id: "acc-1",
    account_type: "TRANSACTION",
    display_name: "Main Account",
    currency: "GBP",
    provider: { display_name: "Mock Bank" },
  };
  const balance = {
    currency: "GBP",
    available: 42.5,
    current: 42.5,
    update_timestamp: "2026-07-25T12:00:00Z",
  };

  it("replies with the formatted balance for an authorized user, and logs success", async () => {
    await storeTokens(testEnv.NAMIVOLT_KV, {
      access_token: "valid-access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/data/v1/accounts")) {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [account] }), { status: 200 }),
        );
      }
      if (url.includes("/balance")) {
        return Promise.resolve(
          new Response(JSON.stringify({ results: [balance] }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({ ...validUpdate, message: { ...validUpdate.message, text: "/balance" } }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    const sendMessageCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("api.telegram.org"),
    );
    expect(sendMessageCall).toBeDefined();
    const body = JSON.parse((sendMessageCall![1] as RequestInit).body as string);
    expect(body.text).toContain("Main Account (Mock Bank)");
    expect(body.text).toContain("Available: 42.5 GBP");
    expect(body.text).toContain("As of 25 Jul 2026, 12:00 UTC");

    const successLog = logSpy.mock.calls
      .map(([entry]) => JSON.parse(entry as string))
      .find((entry) => entry.message === "Balance fetched successfully");
    expect(successLog).toMatchObject({ level: "info", context: "webhook" });

    fetchSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("replies with a friendly fallback message when fetching balance fails", async () => {
    await testEnv.NAMIVOLT_KV.delete("truelayer_tokens");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({ ...validUpdate, message: { ...validUpdate.message, text: "/balance" } }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
    const sendMessageCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).includes("api.telegram.org"),
    );
    const body = JSON.parse((sendMessageCall![1] as RequestInit).body as string);
    expect(body.text).toBe("Couldn't fetch your balance right now. Please try again in a moment.");

    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not attempt a balance fetch for an unauthorized user", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        ...validUpdate,
        message: { ...validUpdate.message, from: { id: UNAUTHORIZED_USER_ID }, text: "/balance" },
      }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe("error handling", () => {
  it("acks 200 and logs instead of crashing on a malformed update", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("https://example.com/webhook", {
      method: "POST",
      headers: { [SECRET_HEADER]: TEST_SECRET },
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 1, from: { id: AUTHORIZED_USER_ID }, chat: null, text: "hi" },
      }),
    });

    const response = await callFetch(request);

    expect(response.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ level: "error", context: "webhook" });

    errorSpy.mockRestore();
  });

  it("returns a friendly 500 and logs when KV fails during /auth", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const putSpy = vi
      .spyOn(testEnv.NAMIVOLT_KV, "put")
      .mockRejectedValueOnce(new Error("KV outage"));

    const response = await callFetch(
      new Request(`https://example.com/auth?secret=${TRUELAYER_SETUP_SECRET}`, { method: "GET" }),
    );

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ level: "error", context: "auth" });

    putSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("/auth endpoint", () => {
  it("redirects to the TrueLayer authorization URL when the setup secret is correct", async () => {
    const request = new Request(`https://example.com/auth?secret=${TRUELAYER_SETUP_SECRET}`, {
      method: "GET",
      redirect: "manual",
    });

    const response = await callFetch(request);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("https://auth.truelayer-sandbox.com");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toMatch(/state=[^&]+/);
  });

  it("returns 401 when the setup secret is missing or wrong", async () => {
    const missing = await callFetch(new Request("https://example.com/auth", { method: "GET" }));
    expect(missing.status).toBe(401);

    const wrong = await callFetch(
      new Request("https://example.com/auth?secret=wrong", { method: "GET" }),
    );
    expect(wrong.status).toBe(401);
  });
});

describe("/callback endpoint", () => {
  async function startAuthFlow(): Promise<string> {
    const response = await callFetch(
      new Request(`https://example.com/auth?secret=${TRUELAYER_SETUP_SECRET}`, {
        method: "GET",
        redirect: "manual",
      }),
    );
    const location = new URL(response.headers.get("Location")!);
    return location.searchParams.get("state")!;
  }

  it("returns 400 when TrueLayer reports an error", async () => {
    const response = await callFetch(
      new Request("https://example.com/callback?error=access_denied", { method: "GET" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid or reused state", async () => {
    const response = await callFetch(
      new Request("https://example.com/callback?state=bogus&code=abc", { method: "GET" }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when code is missing", async () => {
    const state = await startAuthFlow();
    const response = await callFetch(
      new Request(`https://example.com/callback?state=${state}`, { method: "GET" }),
    );

    expect(response.status).toBe(400);
  });

  it("exchanges the code and stores tokens on success", async () => {
    const state = await startAuthFlow();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-xyz",
          refresh_token: "refresh-xyz",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );

    const response = await callFetch(
      new Request(`https://example.com/callback?state=${state}&code=auth-code`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    fetchSpy.mockRestore();
  });

  it("returns 502 when the token exchange fails", async () => {
    const state = await startAuthFlow();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("invalid_grant", { status: 400 }));

    const response = await callFetch(
      new Request(`https://example.com/callback?state=${state}&code=bad-code`, {
        method: "GET",
      }),
    );

    expect(response.status).toBe(502);
    fetchSpy.mockRestore();
  });
});
