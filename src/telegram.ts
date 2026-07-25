import { logError } from "./logger";
import type { Env } from "./types";

export async function sendMessage(chatId: number, text: string, env: Env): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      logError("telegram", "sendMessage failed", new Error(body), {
        status: response.status,
        chatId,
      });
    }
  } catch (err) {
    logError("telegram", "sendMessage threw", err, { chatId });
  }
}
