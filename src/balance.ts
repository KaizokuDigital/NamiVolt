import { getAccountBalance, listAccounts } from "./truelayer";
import type { Env } from "./types";

const TIMESTAMP_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function formatTimestamp(isoTimestamp: string): string {
  return `${TIMESTAMP_FORMAT.format(new Date(isoTimestamp))} UTC`;
}

export async function getBalanceReply(kv: KVNamespace, env: Env): Promise<string> {
  const accounts = await listAccounts(kv, env);
  if (accounts.length === 0) {
    throw new Error("No TrueLayer accounts found. Complete the /auth setup first.");
  }

  const account = accounts.find((a) => a.account_type === "TRANSACTION") ?? accounts[0];
  const balance = await getAccountBalance(account.account_id, kv, env);

  return [
    `${account.display_name} (${account.provider.display_name})`,
    `Available: ${balance.available} ${balance.currency}`,
    `Current: ${balance.current} ${balance.currency}`,
    `As of ${formatTimestamp(balance.update_timestamp)}`,
  ].join("\n");
}
