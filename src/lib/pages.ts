export type PageVersion = { at: number; html: string; note: string };
export type SalesPage = {
  id: string;
  name: string;
  product: string;
  checkoutUrl: string;
  pixelId: string;
  versions: PageVersion[];
  publishedUrl?: string | undefined;
};

/** Injects checkout link, Meta pixel and UTM forwarding so every published page tracks the same way. */
export function finalizeHtml(page: Pick<SalesPage, "checkoutUrl" | "pixelId">, html: string): string {
  let out = html.split("{{CHECKOUT_URL}}").join(page.checkoutUrl || "#");
  const pixel = /^\d{5,20}$/.test(page.pixelId)
    ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${page.pixelId}');fbq('track','PageView');document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a.bg-cta');if(a)fbq('track','InitiateCheckout')});</script>`
    : "";
  const utm = `<script>(function(){var q=location.search;if(!q)return;document.querySelectorAll('a[href^="http"]').forEach(function(a){try{var u=new URL(a.href);new URLSearchParams(q).forEach(function(v,k){if(!u.searchParams.has(k))u.searchParams.set(k,v)});a.href=u.toString()}catch(e){}})})();</script>`;
  const tags = pixel + utm;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, tags + "</body>") : out + tags;
  return out;
}

const KEY = "bat-gotham-pages";
export function loadPages(): SalesPage[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function savePages(p: SalesPage[]) { localStorage.setItem(KEY, JSON.stringify(p)); }
