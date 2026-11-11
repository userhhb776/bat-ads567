/** Private/loopback hosts are refused so the panel can't be used to read internal addresses. */
export function publicHost(u: URL) {
  const h = u.hostname.toLowerCase();
  if (!/^https?:$/.test(u.protocol) || !h.includes(".") || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^(10|127|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.includes(":")) return false;
  return true;
}

/** Turns raw HTML into a short structural outline (title, headings, buttons, key paragraphs) for modeling. */
export function outlineFromHtml(html: string): string {
  const clean = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  const txt = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const out: string[] = [];
  const title = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) out.push(`TÍTULO: ${txt(title)}`);
  const re = /<(h[1-4]|button|a|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) && out.join("\n").length < 7000) {
    const tag = m[1]!.toLowerCase(), t = txt(m[2]!);
    if (!t || t.length < 3) continue;
    if (tag.startsWith("h")) out.push(`${tag.toUpperCase()}: ${t.slice(0, 200)}`);
    else if ((tag === "a" || tag === "button") && t.length <= 60 && /compr|quero|garant|comec|acess|inscr|assin|agend|pedir|adquir|cta|sim/i.test(t)) out.push(`BOTÃO: ${t}`);
    else if ((tag === "p" || tag === "li") && t.length >= 40) out.push(`${tag === "li" ? "ITEM" : "TEXTO"}: ${t.slice(0, 220)}`);
  }
  return [...new Set(out)].join("\n").slice(0, 7000);
}

