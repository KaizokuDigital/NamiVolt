import { describe, expect, it } from "vitest";
import { isPublicCommand, parseCommand } from "./commands";

describe("parseCommand", () => {
  it("extracts the command from plain text", () => {
    expect(parseCommand("/start")).toBe("/start");
  });

  it("strips trailing arguments", () => {
    expect(parseCommand("/balance now")).toBe("/balance");
  });

  it("strips a bot mention suffix", () => {
    expect(parseCommand("/help@NamiVoltBot")).toBe("/help");
  });

  it("returns undefined for undefined text", () => {
    expect(parseCommand(undefined)).toBeUndefined();
  });

  it("returns undefined for empty text", () => {
    expect(parseCommand("")).toBeUndefined();
  });
});

describe("isPublicCommand", () => {
  it("treats /start and /help as public", () => {
    expect(isPublicCommand("/start")).toBe(true);
    expect(isPublicCommand("/help")).toBe(true);
  });

  it("treats other commands as non-public", () => {
    expect(isPublicCommand("/balance")).toBe(false);
  });

  it("treats undefined as non-public", () => {
    expect(isPublicCommand(undefined)).toBe(false);
  });
});
