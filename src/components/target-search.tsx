import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { searchTargeting } from "@/lib/meta.functions";
import { Input } from "@/components/ui/input";

export type TargetItem = { id: string; name: string; type: string; exclude?: boolean };

export function TargetSearch({
  kind,
  value,
  onChange,
  placeholder,
  allowExclude,
}: {
  kind: "interest" | "geo" | "locale";
  value: TargetItem[];
  onChange: (v: TargetItem[]) => void;
  placeholder: string;
  allowExclude?: boolean;
}) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const res = useQuery({
    queryKey: ["search", kind, q],
    queryFn: () => searchTargeting({ data: { kind, q } }),
    enabled: q.length >= 2,
  });

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v.id + String(v.exclude)}
              className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs ${v.exclude ? "bg-destructive/20 text-destructive" : "bg-primary/15 text-primary"}`}
            >
              {allowExclude && (
                <button
                  type="button"
                  className="font-bold"
                  title="Alternar incluir/excluir"
                  onClick={() => onChange(value.map((x) => (x === v ? { ...x, exclude: !x.exclude } : x)))}
                >
                  {v.exclude ? "−" : "+"}
                </button>
              )}
              <span className="truncate">{v.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        {q.length >= 2 && text && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {res.isLoading && <div className="p-3 text-xs text-muted-foreground">Buscando…</div>}
            {res.error && <div className="p-3 text-xs text-destructive">{(res.error as Error).message}</div>}
            {res.data?.length === 0 && <div className="p-3 text-xs text-muted-foreground">Nada encontrado.</div>}
            {res.data?.map((r) => (
              <button
                type="button"
                key={r.id}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  if (!value.some((v) => v.id === r.id)) onChange([...value, { id: r.id, name: r.name, type: r.type }]);
                  setText("");
                }}
              >
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.extra}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
