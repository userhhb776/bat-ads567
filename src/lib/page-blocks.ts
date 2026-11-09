// Visual page builder blocks → standalone HTML (CTA links use {{CHECKOUT_URL}} so finalizeHtml injects checkout, pixel and UTMs).
export type BlockType = "hero" | "video" | "beneficios" | "oferta" | "depoimentos" | "faq" | "cta" | "rodape";
export type Block = { id: string; type: BlockType; title: string; text: string; items: string[]; extra: string };
export type Style = { bg: string; fg: string; accent: string };

export const BLOCKS: Record<BlockType, { label: string; make: () => Omit<Block, "id"> }> = {
  hero: { label: "Topo (headline)", make: () => ({ type: "hero", title: "Sua promessa principal aqui", text: "Subtítulo explicando o resultado para o seu público.", items: [], extra: "Quero agora" }) },
  video: { label: "Vídeo VSL", make: () => ({ type: "video", title: "Assista antes que saia do ar", text: "", items: [], extra: "https://www.youtube.com/embed/" }) },
  beneficios: { label: "Benefícios", make: () => ({ type: "beneficios", title: "O que você vai conseguir", text: "", items: ["Benefício 1", "Benefício 2", "Benefício 3"], extra: "" }) },
  oferta: { label: "Oferta / preço", make: () => ({ type: "oferta", title: "Oferta especial", text: "De R$ 197 por apenas", items: ["Bônus 1", "Garantia de 7 dias"], extra: "R$ 97" }) },
  depoimentos: { label: "Depoimentos", make: () => ({ type: "depoimentos", title: "Quem já comprou", text: "", items: ["Mudou minha rotina! — Ana", "Recomendo demais. — Carlos"], extra: "" }) },
  faq: { label: "Perguntas frequentes", make: () => ({ type: "faq", title: "Dúvidas", text: "", items: ["Como recebo? | Por e-mail logo após a compra.", "Tem garantia? | Sim, 7 dias."], extra: "" }) },
  cta: { label: "Botão de compra", make: () => ({ type: "cta", title: "Garanta sua vaga", text: "Vagas limitadas.", items: [], extra: "Comprar agora" }) },
  rodape: { label: "Rodapé", make: () => ({ type: "rodape", title: "", text: "© Todos os direitos reservados.", items: [], extra: "" }) },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const btn = (label: string) => `<a class="bg-cta" href="{{CHECKOUT_URL}}">${esc(label || "Comprar")}</a>`;

export function blockHtml(b: Block): string {
  const h = b.title ? `<h2>${esc(b.title)}</h2>` : "";
  switch (b.type) {
    case "hero": return `<section class="hero"><h1>${esc(b.title)}</h1><p>${esc(b.text)}</p>${btn(b.extra)}</section>`;
    case "video": return /^https:\/\//.test(b.extra) ? `<section>${h}<div class="vid"><iframe src="${esc(b.extra)}" allowfullscreen></iframe></div></section>` : `<section>${h}</section>`;
    case "beneficios": return `<section>${h}<ul>${b.items.map((i) => `<li>✔ ${esc(i)}</li>`).join("")}</ul></section>`;
    case "oferta": return `<section class="box">${h}<p class="old">${esc(b.text)}</p><p class="price">${esc(b.extra)}</p><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>${btn("Quero aproveitar")}</section>`;
    case "depoimentos": return `<section>${h}${b.items.map((i) => `<blockquote>${esc(i)}</blockquote>`).join("")}</section>`;
    case "faq": return `<section>${h}${b.items.map((i) => { const [q, a] = i.split("|"); return `<details><summary>${esc((q ?? "").trim())}</summary><p>${esc((a ?? "").trim())}</p></details>`; }).join("")}</section>`;
    case "cta": return `<section class="hero">${h}<p>${esc(b.text)}</p>${btn(b.extra)}</section>`;
    case "rodape": return `<footer>${esc(b.text)}</footer>`;
  }
}

export function blocksToHtml(blocks: Block[], st: Style, title = "Página"): string {
  const css = `body{margin:0;font-family:system-ui,sans-serif;background:${st.bg};color:${st.fg};line-height:1.5}section,footer{max-width:760px;margin:0 auto;padding:40px 20px;text-align:center}h1{font-size:2.2rem;margin:0 0 12px}h2{font-size:1.6rem}ul{list-style:none;padding:0}li{margin:8px 0}.bg-cta{display:inline-block;margin-top:16px;padding:16px 32px;border-radius:999px;background:${st.accent};color:#000;font-weight:700;text-decoration:none}.box{border:2px solid ${st.accent};border-radius:16px}.old{text-decoration:line-through;opacity:.6}.price{font-size:2.6rem;font-weight:800;color:${st.accent};margin:0}blockquote{margin:12px 0;padding:16px;border-radius:12px;background:rgba(127,127,127,.12)}details{text-align:left;margin:10px 0;padding:12px;border-radius:10px;background:rgba(127,127,127,.12)}.vid{position:relative;padding-top:56.25%}.vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px}footer{opacity:.6;font-size:.85rem}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>${blocks.map(blockHtml).join("")}</body></html>`;
}
