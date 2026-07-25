import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logInfo, logWarn } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logInfo", () => {
  it("logs a structured JSON entry via console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logInfo("webhook", "Received update", { updateId: 1 });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      level: "info",
      context: "webhook",
      message: "Received update",
      updateId: 1,
    });
  });
});

describe("logWarn", () => {
  it("logs a structured JSON entry via console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logWarn("webhook", "Unauthorized access attempt", { userId: 999 });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      level: "warn",
      context: "webhook",
      message: "Unauthorized access attempt",
      userId: 999,
    });
  });
});

describe("logError", () => {
  it("logs an Error's message via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("callback", "Token exchange failed", new Error("boom"), { status: 400 });

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      level: "error",
      context: "callback",
      message: "Token exchange failed",
      status: 400,
      errorMessage: "boom",
    });
  });

  it("logs a non-Error value under an `error` field", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("callback", "Token exchange failed", "not an Error instance");

    const logged = JSON.parse(spy.mock.calls[0][0] as string);
    expect(logged).toEqual({
      level: "error",
      context: "callback",
      message: "Token exchange failed",
      error: "not an Error instance",
    });
  });
});
