import { isAuthorized } from "./auth";
import type { Env, TelegramUpdate } from "./types";

const WEBHOOK_PATH = "/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== WEBHOOK_PATH || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const secret = request.headers.get(SECRET_HEADER);
    if (!secret || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const userId = update.message?.from?.id;

    if (!isAuthorized(userId, env.AUTHORIZED_USER_IDS)) {
      console.warn("Unauthorized access attempt", {
        userId,
        chatId: update.message?.chat.id,
      });
      return new Response(null, { status: 200 });
    }

    console.log("Received Telegram update", {
      updateId: update.update_id,
      chatId: update.message?.chat.id,
      text: update.message?.text,
    });

    return new Response(null, { status: 200 });
  },
} satisfies ExportedHandler<Env>;
