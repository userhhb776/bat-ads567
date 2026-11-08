import { createContext, useContext } from "react";
import type { SimulationResult } from "@/lib/funnel/types";

export const SimContext = createContext<{ result: SimulationResult; simMode: boolean } | null>(null);
export const useSim = () => { const value = useContext(SimContext); if (!value) throw new Error("Missing simulation context"); return value; };
