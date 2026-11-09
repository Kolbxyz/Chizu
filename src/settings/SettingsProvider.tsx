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
  const [capabilities, setCapabilities] = useState({ code: false, browser: false });
  const [browser, setBrowserState] = useState(() => readSetting("browser") === "1");
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
  const savedToken = readSetting("mapillaryToken");
  const [mapillaryToken, setToken] = useState(savedToken ?? "");
  const [rememberMapillary, setRememberToken] = useState(savedToken !== null);

  useEffect(() => {
    let active = true;
    void probeServer().then((health) => {
      if (!active) return;
      setLocal(!health ? "absent" : health.claudeCode ? "ready" : "no-cli");
      if (health) setCapabilities({ code: health.code, browser: health.browser });
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

  const setMapillaryToken = useCallback((token: string, remember: boolean) => {
    const trimmed = token.trim();
    setToken(trimmed);
    setRememberToken(remember);
    if (remember && trimmed) writeSetting("mapillaryToken", trimmed);
    else clearSetting("mapillaryToken");
  }, []);

  const setBrowser = useCallback((allowed: boolean) => {
    setBrowserState(allowed);
    writeSetting("browser", allowed ? "1" : "0");
  }, []);

  const value = useMemo(() => {
    // Claude Code is only selectable where the local server found the CLI.
    const engine: EngineId = local === "ready" ? chosen : "api";
    const engines =
      local === "absent" || local === "checking"
        ? { api: browserEngine }
        : { cc: serverEngine, api: browserEngine };
    return {
      engine, setEngine, model, setModel, apiKey, rememberKey, setApiKey,
      mapillaryToken, rememberMapillary, setMapillaryToken, local, engines,
      capabilities, browser, setBrowser,
    }; // prettier-ignore
  }, [
    local, chosen, setEngine, model, setModel, apiKey, rememberKey, setApiKey,
    mapillaryToken, rememberMapillary, setMapillaryToken, capabilities, browser, setBrowser,
  ]); // prettier-ignore

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
