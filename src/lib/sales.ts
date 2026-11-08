import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GatewayEvent = {
  id: string; platform: string; external_id: string; status: string; amount: number; currency: string;
  product_name: string | null; customer_email: string | null; customer_phone: string | null;
  utm: Record<string, string>; occurred_at: string;
};

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session, staleTime: 60_000 });
}

/** The private webhook token for this user, created on first use. */
export function useWebhookToken(enabled: boolean) {
  return useQuery({
    queryKey: ["webhook-token"], enabled,
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id; if (!uid) return null;
      const { data } = await supabase.from("user_settings").select("webhook_token").eq("user_id", uid).maybeSingle();
      if (data) return data.webhook_token;
      const { data: made, error } = await supabase.from("user_settings").insert({ user_id: uid }).select("webhook_token").single();
      if (error) throw error;
      return made.webhook_token;
    },
  });
}

export function useGatewayEvents(enabled: boolean, sinceDays = 30) {
  return useQuery({
    queryKey: ["gateway-events", sinceDays], enabled, refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
      const { data, error } = await supabase.from("gateway_events").select("*").gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as GatewayEvent[];
    },
  });
}

/** Latest status per order wins, so a refund cancels an earlier approval. */
export function summarizeSales(events: GatewayEvent[]) {
  const latest = new Map<string, GatewayEvent>();
  for (const e of [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) latest.set(e.platform + ":" + e.external_id, e);
  const orders = [...latest.values()];
  const sum = (s: string) => orders.filter((o) => o.status === s);
  const approved = sum("approved");
  return {
    approvedCount: approved.length,
    revenue: approved.reduce((t, o) => t + Number(o.amount), 0),
    pendingCount: sum("pending").length,
    pendingValue: sum("pending").reduce((t, o) => t + Number(o.amount), 0),
    refundedCount: sum("refunded").length + sum("chargeback").length,
    refusedCount: sum("refused").length,
    orders,
  };
}
