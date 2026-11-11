import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pushPublicKey, testPush } from "@/lib/push.functions";

const toBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Subscribes this device to real phone notifications; the subscription syncs to the cloud for the 24h watch. */
export function PushButton() {
  const getKey = useServerFn(pushPublicKey);
  const test = useServerFn(testPush);
  async function enable() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast.error("Este navegador não aceita notificações. No iPhone, instale o app na tela inicial primeiro."); return;
      }
      if (window.top !== window.self) {
        toast.error("Abra o app oficial instalado na tela inicial — a prévia não pode pedir permissão."); return;
      }
      if ((await Notification.requestPermission()) !== "granted") { toast.error("Notificações bloqueadas nas configurações do celular."); return; }
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const reg = await navigator.serviceWorker.ready;
      await reg.update().catch(() => {});
      const key = await getKey();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const id = json.keys.auth.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
      localStorage.setItem(`bg.push.${id}`, JSON.stringify(json));
      const r = await test({ data: json });
      toast[r.ok ? "success" : "error"](r.ok ? "Notificações ativadas neste aparelho." : "Não consegui enviar o teste.");
    } catch (e) {
      toast.error("Falha ao ativar: " + (e instanceof Error ? e.message : "erro"));
    }
  }
  return <Button variant="outline" onClick={enable}><Bell className="h-4 w-4" /> Notificações</Button>;
}
