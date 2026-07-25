export const WELCOME_MESSAGE = [
  "Welcome to NamiVolt.",
  "",
  "I check your Revolut account balance via TrueLayer.",
  "",
  "Commands:",
  "/balance - Check your balance (authorized users only)",
  "/help - Show this message",
].join("\n");

const PUBLIC_COMMANDS = new Set(["/start", "/help"]);

export function parseCommand(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  return text.trim().split(/\s+/)[0]?.split("@")[0];
}

export function isPublicCommand(command: string | undefined): boolean {
  return command !== undefined && PUBLIC_COMMANDS.has(command);
}
