import { describe, expect, it } from "vitest";
import { finalizeHtml } from "./pages";

describe("finalizeHtml", () => {
  it("replaces checkout placeholder", () => {
    expect(finalizeHtml({ checkoutUrl: "https://pay.x/1", pixelId: "" }, '<a href="{{CHECKOUT_URL}}">x</a>')).toContain('href="https://pay.x/1"');
  });
  it("adds pixel only for numeric id", () => {
    expect(finalizeHtml({ checkoutUrl: "", pixelId: "123456789" }, "<body></body>")).toContain("fbq('init','123456789')");
    expect(finalizeHtml({ checkoutUrl: "", pixelId: "abc'" }, "<body></body>")).not.toContain("fbq('init'");
  });
});
