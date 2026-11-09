import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { listVoices, speakVoice } from '@/lib/voice.functions';
import { getVoiceSettings, saveVoiceSettings, DEFAULT_VOICE, type VoiceSettings } from '@/lib/voice-client';

export function VoiceSettingsCard() {
  const fetchVoices = useServerFn(listVoices); const tts = useServerFn(speakVoice);
  const voices = useQuery({ queryKey: ['eleven-voices'], queryFn: () => fetchVoices(), staleTime: 3600000 });
  const [v, setV] = useState<VoiceSettings>({ voiceId: DEFAULT_VOICE, speed: 1, stability: 0.5 });
  const [testing, setTesting] = useState(false);
  useEffect(() => { setV(getVoiceSettings()); }, []);
  const set = (p: Partial<VoiceSettings>) => { const n = { ...v, ...p }; setV(n); saveVoiceSettings(n); };
  async function test() {
    setTesting(true);
    try { const a = await tts({ data: { text: 'Às suas ordens, chefe. Painel pronto para a próxima operação.', ...v } }); if ('error' in a) toast.error(a.error); else await new Audio(`data:audio/mpeg;base64,${a.audio}`).play(); }
    catch (e) { toast.error((e as Error).message); } finally { setTesting(false); }
  }
  const list = voices.data?.voices ?? [];
  return <section className="space-y-3 rounded-lg border border-border p-4">
    <div><h2 className="font-display text-xl">Voz do Crowley</h2><p className="text-sm text-muted-foreground">Toque no microfone no chat do Crowley para conversar por voz.</p></div>
    <label className="block text-sm">Voz
      <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={v.voiceId} onChange={(e) => set({ voiceId: e.target.value })}>
        {!list.some((x) => x.id === v.voiceId) && <option value={v.voiceId}>{v.voiceId === DEFAULT_VOICE ? 'Crowley (sua voz)' : v.voiceId}</option>}
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}{x.category === 'cloned' ? ' (sua voz)' : ''}{x.labels ? ` — ${x.labels}` : ''}</option>)}
      </select>
    </label>
    {voices.data && 'error' in voices.data && voices.data.error && <p className="text-sm text-destructive">{voices.data.error}</p>}
    <label className="block text-sm">Velocidade: {v.speed.toFixed(2)}×<input type="range" min={0.7} max={1.2} step={0.05} className="w-full" value={v.speed} onChange={(e) => set({ speed: Number(e.target.value) })} /></label>
    <label className="block text-sm">Estabilidade: {Math.round(v.stability * 100)}% <span className="text-muted-foreground">(menos = mais expressiva)</span><input type="range" min={0} max={1} step={0.05} className="w-full" value={v.stability} onChange={(e) => set({ stability: Number(e.target.value) })} /></label>
    <Button size="sm" variant="outline" disabled={testing} onClick={test}><Play className="h-4 w-4" />{testing ? 'Gerando…' : 'Ouvir prévia'}</Button>
  </section>;
}
