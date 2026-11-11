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

import { fillPlaceholders, slugify, whatsappLink } from "./pages";
import { outlineFromHtml, publicHost } from "./page-outline";

describe("page placeholders", () => {
  it("builds the WhatsApp button only from the number the chefe typed", () => {
    expect(whatsappLink("(11) 92149-7891")).toBe("https://wa.me/5511921497891");
    expect(whatsappLink("123")).toBe("");
    expect(fillPlaceholders('a="{{WHATSAPP_URL}}"', { checkoutUrl: "", pixelId: "", whatsapp: "" })).toBe('a=""');
  });
  it("ignores a video link that is not http(s)", () => {
    expect(fillPlaceholders("{{VIDEO_URL}}", { checkoutUrl: "", pixelId: "", videoUrl: "javascript:alert(1)" })).toBe("");
  });
  it("normalizes the page address", () => {
    expect(slugify("Minha Oferta Exclusiva!")).toBe("minha-oferta-exclusiva");
  });
});

describe("modeling a reference page", () => {
  it("refuses private addresses", () => {
    expect(publicHost(new URL("http://localhost:8080"))).toBe(false);
    expect(publicHost(new URL("http://192.168.0.1/x"))).toBe(false);
    expect(publicHost(new URL("https://exemplo.com.br/vsl"))).toBe(true);
  });
  it("keeps structure and drops scripts", () => {
    const o = outlineFromHtml("<title>Oferta</title><script>evil()</script><h1>Emagreça em 30 dias</h1><a href='#'>Quero comprar</a>");
    expect(o).toContain("H1: Emagreça em 30 dias");
    expect(o).toContain("BOTÃO: Quero comprar");
    expect(o).not.toContain("evil");
  });
});
