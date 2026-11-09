// Draws the positions Claude checked (satellite views, Street View, searches
// around a point) as small dashed circles; the latest one is highlighted.
import L from "leaflet";
import type { Probe } from "../../lib/derive.ts";
import { MAP_COLORS } from "./colors.ts";

/** Older checks beyond this count are not drawn, to keep the map readable. */
const MAX_DRAWN = 60;

function dotIcon(latest: boolean): L.DivIcon {
  // Static markup only; Claude-provided text goes into tooltips as text nodes.
  return L.divIcon({
    className: `geo-probe${latest ? " geo-probe--latest" : ""}`,
    html: '<span class="geo-probe__pulse"></span><span class="geo-probe__core"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export class ProbeLayer {
  private readonly group = L.layerGroup();
  private readonly format: (probe: Probe) => string;

  constructor(map: L.Map, format: (probe: Probe) => string) {
    this.group.addTo(map);
    this.format = format;
  }

  /** Replaces the drawn checks; `probes` is in chronological order. */
  update(probes: Probe[]): void {
    this.group.clearLayers();
    const shown = probes.slice(-MAX_DRAWN);
    shown.forEach((probe, index) => {
      const latest = index === shown.length - 1;
      const { lat, lng, radius_m } = probe.at;
      this.group.addLayer(
        L.circle([lat, lng], {
          radius: radius_m,
          color: MAP_COLORS.probe,
          weight: latest ? 2 : 1,
          opacity: latest ? 0.95 : 0.45,
          dashArray: "4 5",
          fillColor: MAP_COLORS.probe,
          fillOpacity: latest ? 0.12 : 0.04,
          interactive: false,
        }),
      );
      const label = document.createElement("span");
      label.textContent = this.format(probe);
      const dot = L.marker([lat, lng], {
        icon: dotIcon(latest),
        opacity: latest ? 1 : 0.6,
        zIndexOffset: latest ? 500 : 0,
        keyboard: false,
      });
      dot.bindTooltip(label, { direction: "top", className: "geo-label", offset: [0, -6] });
      this.group.addLayer(dot);
    });
  }

  clear(): void {
    this.group.clearLayers();
  }
}
