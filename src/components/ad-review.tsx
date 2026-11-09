import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui-kit";
import { getAdReview } from "@/lib/meta.functions";

/** Shows Meta's own preview, approval status and rejection reasons for one ad. */
export function AdReviewDialog({ adId, onClose }: { adId: string; onClose: () => void }) {
  const [format, setFormat] = useState<"MOBILE_FEED_STANDARD" | "DESKTOP_FEED_STANDARD" | "INSTAGRAM_STANDARD" | "INSTAGRAM_STORY">("MOBILE_FEED_STANDARD");
  const q = useQuery({ queryKey: ["ad-review", adId, format], enabled: !!adId, queryFn: () => getAdReview({ data: { adId, format } }) });
  const ad: any = q.data?.ad;
  const feedback = ad?.ad_review_feedback ? Object.entries(ad.ad_review_feedback.global ?? ad.ad_review_feedback).map(([k, v]) => `${k}: ${String(v)}`) : [];
  return (
    <Dialog open={!!adId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{ad?.name ?? "Anúncio"}</DialogTitle></DialogHeader>
        <NativeSelect value={format} onChange={(e) => setFormat(e.target.value as never)}>
          <option value="MOBILE_FEED_STANDARD">Feed celular</option><option value="DESKTOP_FEED_STANDARD">Feed computador</option><option value="INSTAGRAM_STANDARD">Instagram feed</option><option value="INSTAGRAM_STORY">Instagram stories</option>
        </NativeSelect>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Consultando a Meta…</p> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : (
          <div className="space-y-3 text-sm">
            <div>Status: <b>{ad?.effective_status}</b></div>
            {feedback.length > 0 && <div className="rounded-md border border-destructive p-2 text-xs text-destructive"><b>Reprovação:</b>{feedback.map((f) => <div key={f}>{f}</div>)}</div>}
            {(ad?.issues_info ?? []).map((i: any, n: number) => <div key={n} className="rounded-md border border-border p-2 text-xs">{i.error_summary}: {i.error_message}</div>)}
            {ad?.creative?.url_tags && <div className="text-xs text-muted-foreground">Parâmetros: {ad.creative.url_tags}</div>}
            {q.data?.previewUrl ? <iframe title="Prévia" src={q.data.previewUrl} className="h-[560px] w-full rounded-md border border-border bg-background" /> : <p className="text-xs text-muted-foreground">Prévia indisponível neste formato.</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
