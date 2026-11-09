import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "leaflet/dist/leaflet.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App.tsx";
import { I18nProvider } from "./i18n/I18nProvider.tsx";
import { SettingsProvider } from "./settings/SettingsProvider.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>
  </StrictMode>,
);
