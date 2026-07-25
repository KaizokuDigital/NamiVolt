import type { Env } from "./types";

export async function sendMessage(chatId: number, text: string, env: Env): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Telegram sendMessage failed", { status: response.status, body });
  }
}
