import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "nope", "yes")).toBe("base yes");
  });

  it("deduplicates via tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("removes undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("handles objects", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  it("handles arrays", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("merges conflicting tailwind bg classes", () => {
    expect(cn("bg-red-100", "bg-blue-200")).toBe("bg-blue-200");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
