import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Layers, Map as MapIcon } from "lucide-react";
import type { ExifSummary } from "../../../shared/job.ts";
import type { Candidate, Estimate } from "../../../shared/schema.ts";
import { useI18n } from "../../i18n/context.ts";
import { formatDistance, formatPercent } from "../../lib/format.ts";
import { readSetting, writeSetting } from "../../lib/settings.ts";
import { CandidateLayer } from "./candidateLayer.ts";
import "./GeoMap.css";

type BaseLayer = "satellite" | "streets";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const TILES = {
  imagery: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
  labels: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
  streets: (dark: boolean) =>
    `https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "rastertile/voyager"}/{z}/{x}/{y}{r}.png`,
};
/** Above this radius a circle covers most of the globe; show the whole world instead. */
const WORLD_RADIUS_M = 3_000_000;

interface Props {
  estimate?: Estimate;
  exif: ExifSummary[];
  dark: boolean;
}

export function GeoMap({ estimate, exif, dark }: Props) {
  const { t, locale } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const candidates = useRef<CandidateLayer | null>(null);
  const overlays = useRef<L.LayerGroup | null>(null);
  const base = useRef<L.LayerGroup | null>(null);
  const [layer, setLayer] = useState<BaseLayer>(() =>
    readSetting("layer") === "streets" ? "streets" : "satellite",
  );
  const formatRef = useRef<(c: Candidate) => string>(() => "");
  useEffect(() => {
    formatRef.current = (c) =>
      `${c.label} · ${formatPercent(c.confidence, locale)} · ± ${formatDistance(c.radius_m, locale)}`;
  }, [locale]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      center: [25, 10],
      zoom: 2,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    base.current = L.layerGroup().addTo(instance);
    overlays.current = L.layerGroup().addTo(instance);
    candidates.current = new CandidateLayer(instance, (c) => formatRef.current(c));
    map.current = instance;
    return () => {
      candidates.current?.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = base.current;
    if (!group) return;
    group.clearLayers();
    if (layer === "satellite") {
      group.addLayer(L.tileLayer(TILES.imagery, { maxZoom: 19, maxNativeZoom: 19 }));
      group.addLayer(L.tileLayer(TILES.labels, { maxZoom: 19, pane: "overlayPane", opacity: 0.9 }));
    } else {
      group.addLayer(L.tileLayer(TILES.streets(dark), { maxZoom: 19, subdomains: "abcd" }));
    }
  }, [layer, dark]);

  useEffect(() => {
    candidates.current?.update(estimate?.candidates ?? []);
    const instance = map.current;
    if (!instance) return;
    if (!estimate) {
      instance.flyTo([25, 10], 2, { duration: 0.8 });
      return;
    }
    focus(instance, estimate.candidates);
  }, [estimate]);

  useEffect(() => {
    const group = overlays.current;
    if (!group) return;
    group.clearLayers();
    for (const point of exif) {
      if (point.lat === undefined || point.lng === undefined) continue;
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "geo-exif",
          html: '<span class="geo-exif__cone"></span><span class="geo-exif__core"></span>',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      });
      marker.on("add", () => {
        const cone = marker.getElement()?.querySelector<HTMLElement>(".geo-exif__cone");
        if (cone) {
          cone.hidden = point.heading === undefined;
          cone.style.rotate = `${point.heading ?? 0}deg`;
        }
      });
      marker.bindTooltip(t("map.exif"), { direction: "bottom", className: "geo-label" });
      group.addLayer(marker);
    }
  }, [exif, t]);

  const choose = (next: BaseLayer) => {
    setLayer(next);
    writeSetting("layer", next);
  };

  return (
    <div className="geo-map">
      <div ref={container} className="geo-map__canvas" />
      <div className="geo-map__layers" role="group" aria-label={t("map.satellite")}>
        <button
          type="button"
          aria-pressed={layer === "satellite"}
          onClick={() => choose("satellite")}
        >
          <Layers size={16} aria-hidden /> {t("map.satellite")}
        </button>
        <button type="button" aria-pressed={layer === "streets"} onClick={() => choose("streets")}>
          <MapIcon size={16} aria-hidden /> {t("map.streets")}
        </button>
      </div>
      <p className="geo-map__attribution">{t("map.attribution")}</p>
    </div>
  );
}

/** Frames the best hypothesis together with the alternatives that are nearly as likely. */
function focus(map: L.Map, candidates: Candidate[]) {
  const best = candidates[0];
  if (!best) return;
  const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (best.radius_m >= WORLD_RADIUS_M) {
    map.flyTo([best.lat, best.lng], 2, { animate, duration: 1.2 });
    return;
  }
  const bounds = candidates
    .filter(
      (c) => c === best || (c.confidence >= best.confidence * 0.5 && c.radius_m < WORLD_RADIUS_M),
    )
    .map((c) => L.latLng(c.lat, c.lng).toBounds(c.radius_m * 2))
    .reduce((all, b) => all.extend(b));
  map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 18, animate, duration: 1.4 });
}
