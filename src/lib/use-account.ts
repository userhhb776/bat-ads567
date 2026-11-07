import { useEffect, useState } from "react";

const KEY = "batads.account";

export function useAccount() {
  const [account, setAccountState] = useState<string>("");
  useEffect(() => {
    setAccountState(localStorage.getItem(KEY) ?? "");
  }, []);
  const setAccount = (id: string) => {
    localStorage.setItem(KEY, id);
    setAccountState(id);
  };
  return [account, setAccount] as const;
}

export const brl = (v: number | string | undefined | null) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function actionValue(list: { action_type: string; value: string }[] | undefined, types: string[]) {
  const f = list?.find((a) => types.includes(a.action_type));
  return f ? Number(f.value) : 0;
}
