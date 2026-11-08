import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, Empty, Field, NativeSelect, PageHead, Stat, head } from "@/components/ui-kit";
import { useStore, uid, toCsv, fromCsv, download } from "@/lib/store";
import { ORDER_LABEL, salesSummary, type Order, type OrderStatus, type Product } from "@/lib/biz";
import { loadPages, type SalesPage } from "@/lib/pages";
import { useEffect } from "react";

export const Route = createFileRoute("/produtos")({
  head: () => head("Produtos e vendas", "Produtos, ofertas, cupons, pedidos e relatórios por produto."),
  component: ProductsRoute,
});

const blank = (): Product => ({ id: uid(), name: "Novo produto", kind: "digital", price: 97, cost: 0, currency: "BRL", checkoutUrl: "", deliveryUrl: "", pageId: "", funnelName: "", campaignIds: "", offers: [], coupons: [], knowledge: "" });
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProductsRoute() {
  const [products, setProducts] = useStore<Product[]>("products", []);
  const [orders, setOrders] = useStore<Order[]>("orders", []);
  const [sel, setSel] = useState<string>("");
  const [tab, setTab] = useState<"produto" | "pedidos">("produto");
  const [pages, setPages] = useState<SalesPage[]>([]);
  useEffect(() => { setPages(loadPages()); }, []);
  const p = products.find((x) => x.id === sel) ?? products[0];
  const patch = (c: Partial<Product>) => p && setProducts(products.map((x) => (x.id === p.id ? { ...x, ...c } : x)));
  const total = salesSummary(orders);

  const importOrders = async (f: File) => {
    const rows = fromCsv(await f.text());
    const mapped: Order[] = rows.map((r) => ({
      id: r["id"] || uid(), productId: products.find((x) => x.name.toLowerCase() === (r["produto"] || "").toLowerCase())?.id ?? p?.id ?? "",
      customer: r["nome"] || r["cliente"] || "", email: r["email"] || "", phone: r["telefone"] || "", amount: Number((r["valor"] || "0").replace(",", ".")),
      status: (Object.keys(ORDER_LABEL).includes(r["status"] ?? "") ? r["status"] : "aprovado") as OrderStatus,
      method: (r["metodo"] as Order["method"]) || "pix", gateway: r["gateway"] || "", at: Date.parse(r["data"] ?? "") || Date.now(),
      utm_source: r["utm_source"] || "", utm_campaign: r["utm_campaign"] || "", utm_content: r["utm_content"] || "",
    }));
    setOrders([...mapped, ...orders.filter((o) => !mapped.some((m) => m.id === o.id))]);
  };

  return (
    <div className="space-y-4 p-4 pb-24 md:p-6">
      <PageHead title="Produtos e vendas" sub="Cada produto liga página, funil, checkout, campanhas e suporte.">
        <Button variant={tab === "produto" ? "default" : "outline"} onClick={() => setTab("produto")}>Produtos</Button>
        <Button variant={tab === "pedidos" ? "default" : "outline"} onClick={() => setTab("pedidos")}>Pedidos</Button>
      </PageHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Faturamento aprovado" value={fmt(total.revenue)} />
        <Stat label="Vendas" value={total.count} />
        <Stat label="Ticket médio" value={fmt(total.ticket)} />
        <Stat label="Pendente (Pix/boleto)" value={fmt(total.pending)} />
        <Stat label="Reembolsos" value={fmt(total.refunded)} />
      </div>

      {tab === "produto" ? (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <Button className="w-full" onClick={() => { const n = blank(); setProducts([n, ...products]); setSel(n.id); }}><Plus className="h-4 w-4" /> Produto</Button>
            {products.map((x) => {
              const s = salesSummary(orders, x.id);
              return (
                <button key={x.id} onClick={() => setSel(x.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${p?.id === x.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  <div className="truncate font-medium">{x.name}</div>
                  <div className="text-xs text-muted-foreground">{s.count} vendas · {fmt(s.revenue)}</div>
                </button>
              );
            })}
          </div>
          {!p ? <Empty>Cadastre seu primeiro produto.</Empty> : (
            <div className="space-y-4">
              <Card className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome"><Input value={p.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
                <Field label="Tipo"><NativeSelect value={p.kind} onChange={(e) => patch({ kind: e.target.value as Product["kind"] })}><option value="digital">Digital</option><option value="fisico">Físico</option></NativeSelect></Field>
                <Field label="Preço"><Input type="number" value={p.price} onChange={(e) => patch({ price: Number(e.target.value) })} /></Field>
                <Field label="Custo por venda (taxas, entrega)"><Input type="number" value={p.cost} onChange={(e) => patch({ cost: Number(e.target.value) })} /></Field>
                <Field label="Link do checkout (gateway)"><Input value={p.checkoutUrl} onChange={(e) => patch({ checkoutUrl: e.target.value })} placeholder="https://" /></Field>
                <Field label="Link de entrega/acesso"><Input value={p.deliveryUrl} onChange={(e) => patch({ deliveryUrl: e.target.value })} placeholder="https://" /></Field>
                <Field label="Página de vendas"><NativeSelect value={p.pageId} onChange={(e) => patch({ pageId: e.target.value })}><option value="">—</option>{pages.map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}</NativeSelect></Field>
                <Field label="IDs das campanhas (separe por vírgula)"><Input value={p.campaignIds} onChange={(e) => patch({ campaignIds: e.target.value })} /></Field>
              </Card>
              <Card className="space-y-2">
                <div className="flex items-center justify-between"><h2 className="font-display text-xl">Ofertas</h2>
                  <Button size="sm" variant="outline" onClick={() => patch({ offers: [...p.offers, { id: uid(), name: "Oferta", type: "order_bump", price: 27 }] })}><Plus className="h-4 w-4" /></Button></div>
                {p.offers.map((o, i) => (
                  <div key={o.id} className="grid grid-cols-[1fr_120px_90px_auto] gap-2">
                    <Input value={o.name} onChange={(e) => patch({ offers: p.offers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <NativeSelect value={o.type} onChange={(e) => patch({ offers: p.offers.map((x, j) => (j === i ? { ...x, type: e.target.value as any } : x)) })}>
                      <option value="principal">Principal</option><option value="order_bump">Order bump</option><option value="upsell">Upsell</option><option value="downsell">Downsell</option></NativeSelect>
                    <Input type="number" value={o.price} onChange={(e) => patch({ offers: p.offers.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)) })} />
                    <Button size="icon" variant="ghost" onClick={() => patch({ offers: p.offers.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </Card>
              <Card className="space-y-2">
                <div className="flex items-center justify-between"><h2 className="font-display text-xl">Cupons</h2>
                  <Button size="sm" variant="outline" onClick={() => patch({ coupons: [...p.coupons, { code: "PROMO10", percent: 10 }] })}><Plus className="h-4 w-4" /></Button></div>
                {p.coupons.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-2">
                    <Input value={c.code} onChange={(e) => patch({ coupons: p.coupons.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)) })} />
                    <Input type="number" value={c.percent} onChange={(e) => patch({ coupons: p.coupons.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) } : x)) })} />
                    <Button size="icon" variant="ghost" onClick={() => patch({ coupons: p.coupons.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </Card>
              <Card className="space-y-2">
                <h2 className="font-display text-xl">Base de conhecimento do suporte</h2>
                <Textarea value={p.knowledge} onChange={(e) => patch({ knowledge: e.target.value })} className="min-h-32" placeholder="Como acessar, prazos, garantia, perguntas frequentes…" />
              </Card>
              <Button variant="ghost" onClick={() => setProducts(products.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" /> Excluir produto</Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Upload className="h-4 w-4" /> Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importOrders(e.target.files[0])} /></label>
            <Button variant="outline" onClick={() => download("pedidos.csv", toCsv(orders))}><Download className="h-4 w-4" /> Exportar</Button>
            <Button variant="outline" onClick={() => p && setOrders([{ id: uid(), productId: p.id, customer: "", email: "", phone: "", amount: p.price, status: "pix_gerado", method: "pix", gateway: "manual", at: Date.now(), utm_source: "", utm_campaign: "", utm_content: "" }, ...orders])}><Plus className="h-4 w-4" /> Pedido manual</Button>
          </div>
          <p className="text-xs text-muted-foreground">Colunas aceitas no CSV: id, produto, nome, email, telefone, valor, status, metodo, gateway, data, utm_source, utm_campaign, utm_content. Nunca guardamos dados de cartão.</p>
          {orders.length === 0 ? <Empty>Nenhum pedido ainda.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Data</th><th>Cliente</th><th>Produto</th><th>Valor</th><th>Status</th><th>Origem</th><th /></tr></thead>
                <tbody>
                  {orders.slice(0, 300).map((o) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{new Date(o.at).toLocaleDateString("pt-BR")}</td>
                      <td><Input className="h-8" value={o.customer} placeholder="nome" onChange={(e) => setOrders(orders.map((x) => (x.id === o.id ? { ...x, customer: e.target.value } : x)))} /></td>
                      <td className="px-2">{products.find((x) => x.id === o.productId)?.name ?? "—"}</td>
                      <td className="px-2 whitespace-nowrap">{fmt(o.amount)}</td>
                      <td><NativeSelect value={o.status} onChange={(e) => setOrders(orders.map((x) => (x.id === o.id ? { ...x, status: e.target.value as OrderStatus } : x)))}>
                        {Object.entries(ORDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></td>
                      <td className="px-2 text-xs text-muted-foreground">{o.utm_campaign || o.utm_source || "—"}</td>
                      <td><Button size="icon" variant="ghost" onClick={() => setOrders(orders.filter((x) => x.id !== o.id))}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
