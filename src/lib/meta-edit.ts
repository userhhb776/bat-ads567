/** Pure helpers for editing an existing ad's creative (Meta creatives are immutable, so a patched copy is created). */
export type CreativePatch = { message?: string | undefined; headline?: string | undefined; description?: string | undefined; link?: string | undefined; image_hash?: string | undefined; video_id?: string | undefined };

export function patchStorySpec(spec: any, p: CreativePatch) {
  const s: any = JSON.parse(JSON.stringify(spec ?? {}));
  const setCta = (cta: any) => (cta && p.link ? { ...cta, value: { ...(cta.value ?? {}), link: p.link } } : cta);
  if (s["video_data"]) {
    const v = s["video_data"];
    if (p.message !== undefined) v.message = p.message;
    if (p.headline !== undefined) v.title = p.headline;
    if (p.description !== undefined) v.link_description = p.description;
    if (p.video_id) v.video_id = p.video_id;
    if (p.image_hash) { v.image_hash = p.image_hash; delete v.image_url; }
    else if (v.image_hash && v.image_url) delete v.image_url; // Meta rejects both together
    v.call_to_action = setCta(v.call_to_action);
  } else if (s["link_data"]) {
    const l = s["link_data"];
    if (p.message !== undefined) l.message = p.message;
    if (p.link) l.link = p.link;
    if (l.child_attachments?.length) {
      if (p.link) l.child_attachments = l.child_attachments.map((c: any) => ({ ...c, link: p.link, call_to_action: setCta(c.call_to_action) }));
    } else {
      if (p.headline !== undefined) l.name = p.headline;
      if (p.description !== undefined) l.description = p.description;
      if (p.image_hash) { l.image_hash = p.image_hash; delete l.picture; }
      else if (l.image_hash && l.picture) delete l.picture;
    }
    l.call_to_action = setCta(l.call_to_action);
  } else {
    throw new Error("Formato de anúncio sem texto editável por aqui.");
  }
  return s;
}

/** Readable text fields of a creative for the edit form. */
export function readCreative(spec: any) {
  const v = spec?.["video_data"], l = spec?.["link_data"];
  if (v) return { kind: "video" as const, message: v.message ?? "", headline: v.title ?? "", description: v.link_description ?? "", link: v.call_to_action?.value?.link ?? "" };
  if (l) return { kind: l.child_attachments?.length ? ("carousel" as const) : ("image" as const), message: l.message ?? "", headline: l.name ?? "", description: l.description ?? "", link: l.link ?? "" };
  return { kind: "other" as const, message: "", headline: "", description: "", link: "" };
}
