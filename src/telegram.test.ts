/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "./telegram";
import type { Env } from "./types";

const testEnv = env as unknown as Env;
testEnv.TELEGRAM_BOT_TOKEN = "test-bot-token";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendMessage", () => {
  it("posts to the Telegram sendMessage endpoint with the chat id and text", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await sendMessage(123, "hello", testEnv);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: 123, text: "hello" }),
      }),
    );
  });

  it("does not throw when Telegram responds with an error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad request", { status: 400 })));

    await expect(sendMessage(123, "hello", testEnv)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
