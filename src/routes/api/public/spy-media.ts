import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = /(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com)$/;

/** Streams a Meta Ad Library creative as a download. Only Meta CDN hosts are allowed, so it can't be used as an open proxy. */
export const Route = createFileRoute("/api/public/spy-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;
        let target: URL;
        try { target = new URL(q.get("u") ?? ""); } catch { return new Response("Bad url", { status: 400 }); }
        if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) return new Response("Forbidden", { status: 403 });
        const r = await fetch(target.toString());
        if (!r.ok || !r.body) return new Response("Creative unavailable", { status: 502 });
        const type = r.headers.get("content-type") ?? "application/octet-stream";
        const ext = type.includes("mp4") ? "mp4" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("video") ? "mp4" : "jpg";
        const name = (q.get("n") ?? "criativo").replace(/[^\w.-]+/g, "-").slice(0, 60) || "criativo";
        return new Response(r.body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}.${ext}"`, "Cache-Control": "private, max-age=3600" } });
      },
    },
  },
});
