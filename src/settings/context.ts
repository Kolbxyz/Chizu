import { createContext, useContext } from "react";
import type { ApiModel } from "../engines/browser/pricing.ts";
import type { Engine, EngineId } from "../engines/types.ts";

/** "ready": server and CLI found; "no-cli": server without `claude`; "absent": static hosting. */
export type LocalStatus = "checking" | "ready" | "no-cli" | "absent";

export interface Settings {
  /** Engine used for new analyses. */
  engine: EngineId;
  setEngine: (engine: EngineId) => void;
  model: ApiModel;
  setModel: (model: ApiModel) => void;
  apiKey: string;
  rememberKey: boolean;
  setApiKey: (key: string, remember: boolean) => void;
  local: LocalStatus;
  /** Engines whose history is available on this host. */
  engines: Partial<Record<EngineId, Engine>>;
}

export const SettingsContext = createContext<Settings | null>(null);

export function useSettings(): Settings {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings outside SettingsProvider");
  return value;
}
