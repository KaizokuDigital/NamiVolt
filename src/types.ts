export interface Env {
  NAMIVOLT_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  AUTHORIZED_USER_IDS: string;
  REVOLUT_CLIENT_ID: string;
  REVOLUT_CLIENT_SECRET: string;
  REVOLUT_ACCOUNT_ID: string;
  TRUELAYER_CLIENT_ID: string;
  TRUELAYER_CLIENT_SECRET: string;
  TRUELAYER_AUTH_BASE_URL: string;
  TRUELAYER_REDIRECT_URI: string;
  TRUELAYER_PROVIDERS: string;
  TRUELAYER_SETUP_SECRET: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}
