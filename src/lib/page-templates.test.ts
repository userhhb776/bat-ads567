import { describe, expect, it } from "vitest";
import { TEMPLATES, templateCode } from "./page-templates";

describe("page templates", () => {
  it("offers the four requested models", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["loja", "vsl", "servicos", "suplemento"]);
  });
  it("routes every buy button through the panel checkout link with UTMs and pixel", () => {
    for (const t of TEMPLATES) {
      const code = templateCode(t.id);
      expect(code).toContain('"{{CHECKOUT_URL}}"');
      expect(code).toContain("batTracking.attributedUrl(CHECKOUT_URL)");
      expect(code).toContain('pixelId: "{{PIXEL_ID}}"');
    }
  });
  it("never presents invented testimonials as real", () => {
    for (const t of TEMPLATES) for (const x of t.data.testimonials.items) expect(x.text).toContain("substitua");
  });
  it("uses the product name as the brand", () => {
    expect(templateCode("vsl", "Cozinha de 15 Minutos")).toContain('"brand": "Cozinha de 15 Minutos"');
  });
});
