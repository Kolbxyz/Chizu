import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createBrowserEngine, type ApiConfig } from "../engines/browser/engine.ts";
import { DEFAULT_MODEL, MODELS, type ApiModel } from "../engines/browser/pricing.ts";
import { probeServer, serverEngine } from "../engines/server.ts";
import type { EngineId } from "../engines/types.ts";
import { clearSetting, readSetting, writeSetting } from "../lib/settings.ts";
import { SettingsContext, type LocalStatus } from "./context.ts";

/** One API engine per page; the provider keeps its configuration current. */
const apiConfig: ApiConfig = { model: DEFAULT_MODEL };
const browserEngine = createBrowserEngine(() => apiConfig);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<LocalStatus>("checking");
  const [chosen, setChosen] = useState<EngineId>(() =>
    readSetting("engine") === "api" ? "api" : "cc",
  );
  const [model, setModelState] = useState<ApiModel>(() => {
    const saved = readSetting("model");
    return MODELS.find((m) => m === saved) ?? DEFAULT_MODEL;
  });
  const savedKey = readSetting("apiKey");
  const [apiKey, setKey] = useState(savedKey ?? "");
  const [rememberKey, setRemember] = useState(savedKey !== null);

  useEffect(() => {
    let active = true;
    void probeServer().then((health) => {
      if (active) setLocal(!health ? "absent" : health.claudeCode ? "ready" : "no-cli");
    });
    return () => {
      active = false;
    };
  }, []);

  // The engine reads the key and model when a run starts.
  useEffect(() => {
    apiConfig.apiKey = apiKey;
    apiConfig.model = model;
  }, [apiKey, model]);

  const setEngine = useCallback((engine: EngineId) => {
    setChosen(engine);
    writeSetting("engine", engine);
  }, []);
  const setModel = useCallback((next: ApiModel) => {
    setModelState(next);
    writeSetting("model", next);
  }, []);
  const setApiKey = useCallback((key: string, remember: boolean) => {
    const trimmed = key.trim();
    setKey(trimmed);
    setRemember(remember);
    if (remember && trimmed) writeSetting("apiKey", trimmed);
    else clearSetting("apiKey");
  }, []);

  const value = useMemo(() => {
    // Claude Code is only selectable where the local server found the CLI.
    const engine: EngineId = local === "ready" ? chosen : "api";
    const engines =
      local === "absent" || local === "checking"
        ? { api: browserEngine }
        : { cc: serverEngine, api: browserEngine };
    return { engine, setEngine, model, setModel, apiKey, rememberKey, setApiKey, local, engines };
  }, [local, chosen, setEngine, model, setModel, apiKey, rememberKey, setApiKey]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
