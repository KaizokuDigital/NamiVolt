import { describe, expect, it } from "vitest";
import { isAuthorized } from "./auth";

describe("isAuthorized", () => {
  it("returns true for a user id in the list", () => {
    expect(isAuthorized(123, "123,456")).toBe(true);
  });

  it("returns false for a user id not in the list", () => {
    expect(isAuthorized(999, "123,456")).toBe(false);
  });

  it("returns false when userId is undefined", () => {
    expect(isAuthorized(undefined, "123,456")).toBe(false);
  });

  it("tolerates whitespace and trailing commas", () => {
    expect(isAuthorized(456, " 123 , 456 ,")).toBe(true);
  });

  it("fails closed on an empty list", () => {
    expect(isAuthorized(123, "")).toBe(false);
  });
});
