import { isAuthorized } from "./auth";
import { isPublicCommand, parseCommand, WELCOME_MESSAGE } from "./commands";
import { logError, logInfo, logWarn } from "./logger";
import { sendMessage } from "./telegram";
import {
  buildAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeCodeForToken,
  storeTokens,
} from "./truelayer";
import type { Env, TelegramUpdate } from "./types";

const WEBHOOK_PATH = "/webhook";
const AUTH_PATH = "/auth";
const CALLBACK_PATH = "/callback";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === AUTH_PATH && request.method === "GET") {
      return handleAuth(request, env);
    }

    if (url.pathname === CALLBACK_PATH && request.method === "GET") {
      return handleCallback(request, env);
    }

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

    try {
      return await handleMessage(update, env);
    } catch (err) {
      logError("webhook", "Unhandled error while processing update", err, {
        updateId: update.update_id,
      });
      return new Response(null, { status: 200 });
    }
  },
} satisfies ExportedHandler<Env>;

async function handleMessage(update: TelegramUpdate, env: Env): Promise<Response> {
  const command = parseCommand(update.message?.text);
  const chatId = update.message?.chat.id;

  if (isPublicCommand(command) && chatId !== undefined) {
    await sendMessage(chatId, WELCOME_MESSAGE, env);
    return new Response(null, { status: 200 });
  }

  const userId = update.message?.from?.id;

  if (!isAuthorized(userId, env.AUTHORIZED_USER_IDS)) {
    logWarn("webhook", "Unauthorized access attempt", {
      userId,
      chatId: update.message?.chat.id,
    });
    return new Response(null, { status: 200 });
  }

  logInfo("webhook", "Received Telegram update", {
    updateId: update.update_id,
    chatId: update.message?.chat.id,
    text: update.message?.text,
  });

  return new Response(null, { status: 200 });
}

async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!secret || secret !== env.TRUELAYER_SETUP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const state = await createOAuthState(env.NAMIVOLT_KV);
    const authorizationUrl = buildAuthorizationUrl(env, state);
    return Response.redirect(authorizationUrl, 302);
  } catch (err) {
    logError("auth", "Failed to start TrueLayer authorization", err);
    return new Response("Failed to start authorization. Please try again.", { status: 500 });
  }
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return new Response(`TrueLayer authorization failed: ${error}`, { status: 400 });
  }

  const state = url.searchParams.get("state");
  const stateValid = await consumeOAuthState(env.NAMIVOLT_KV, state);
  if (!stateValid) {
    return new Response("Invalid or expired state", { status: 400 });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForToken(code, env);
    await storeTokens(env.NAMIVOLT_KV, tokens);
  } catch (err) {
    logError("callback", "TrueLayer token exchange failed", err);
    return new Response("Token exchange failed", { status: 502 });
  }

  return new Response("TrueLayer account connected successfully. You can close this tab.", {
    status: 200,
  });
}
