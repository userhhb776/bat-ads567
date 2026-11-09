import { describe, expect, it } from "vitest";
import { BLOCKS, blocksToHtml } from "./page-blocks";
import { finalizeHtml } from "./pages";

const st = { bg: "#000", fg: "#fff", accent: "#d4af37" };
describe("page blocks", () => {
  it("CTA links get the checkout URL after finalize", () => {
    const html = blocksToHtml([{ id: "1", ...BLOCKS.hero.make() }], st);
    expect(finalizeHtml({ checkoutUrl: "https://pay.x/1", pixelId: "" }, html)).toContain('href="https://pay.x/1"');
  });
  it("escapes user text", () => {
    const html = blocksToHtml([{ id: "1", ...BLOCKS.hero.make(), title: "<script>x</script>" }], st);
    expect(html).not.toContain("<script>x");
  });
  it("ignores non-https video urls", () => {
    expect(blocksToHtml([{ id: "1", ...BLOCKS.video.make(), extra: "javascript:alert(1)" }], st)).not.toContain("javascript:");
  });
});
