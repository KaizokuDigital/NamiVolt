/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./types";

const testEnv = env as unknown as Env;

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const TEST_SECRET = "test-webhook-secret";

const validUpdate = {
  update_id: 1,
  message: {
    message_id: 1,
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

beforeEach(() => {
  testEnv.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
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
});
