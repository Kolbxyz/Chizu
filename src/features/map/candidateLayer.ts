// Draws location hypotheses as uncertainty circles with a centre dot, coloured
// by confidence, and animates each one (by id) from its previous position and
// radius to the new one.
import L from "leaflet";
import type { Candidate } from "../../../shared/schema.ts";
import { MAP_COLORS, confidenceBand } from "./colors.ts";

const TWEEN_MS = 1100;
const FADE_MS = 400;

interface Drawn {
  candidate: Candidate;
  circle: L.Circle;
  dot: L.Marker;
  label: HTMLElement;
  frame?: number;
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function dotIcon(candidate: Candidate, best: boolean): L.DivIcon {
  // Static markup only; Claude-provided text never goes through innerHTML.
  const band = confidenceBand(candidate.confidence);
  return L.divIcon({
    className: `geo-dot geo-dot--${band} ${best ? "geo-dot--best" : "geo-dot--alt"}`,
    html: '<span class="geo-dot__pulse"></span><span class="geo-dot__core"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function circleStyle(candidate: Candidate, best: boolean): L.PathOptions {
  const color = MAP_COLORS[confidenceBand(candidate.confidence)];
  return {
    color,
    weight: best ? 2.5 : 1.5,
    dashArray: best ? undefined : "6 6",
    fillColor: color,
    fillOpacity: 0.06 + 0.14 * candidate.confidence,
    className: "geo-circle",
  };
}

export class CandidateLayer {
  private readonly group = L.layerGroup();
  private readonly drawn = new Map<string, Drawn>();
  private readonly format: (candidate: Candidate) => string;

  constructor(map: L.Map, format: (candidate: Candidate) => string) {
    this.group.addTo(map);
    this.format = format;
  }

  /** Replaces the displayed set; candidates[0] is the best hypothesis. */
  update(candidates: Candidate[]): void {
    const animate = !prefersReducedMotion();
    const keep = new Set(candidates.map((c) => c.id));
    for (const [id, drawn] of this.drawn) {
      if (!keep.has(id)) this.removeDrawn(id, drawn, animate);
    }
    candidates.forEach((candidate, index) => {
      const best = index === 0;
      const existing = this.drawn.get(candidate.id);
      if (existing) this.morph(existing, candidate, best, animate);
      else this.create(candidate, best, animate);
    });
  }

  clear(): void {
    for (const drawn of this.drawn.values()) if (drawn.frame) cancelAnimationFrame(drawn.frame);
    this.drawn.clear();
    this.group.clearLayers();
  }

  private create(candidate: Candidate, best: boolean, animate: boolean): void {
    const center = L.latLng(candidate.lat, candidate.lng);
    const circle = L.circle(center, {
      radius: animate ? candidate.radius_m * 2.5 : candidate.radius_m,
      ...circleStyle(candidate, best),
    });
    const label = document.createElement("span");
    const dot = L.marker(center, {
      icon: dotIcon(candidate, best),
      keyboard: false,
      zIndexOffset: best ? 1000 : 0,
    });
    dot.bindTooltip(label, {
      permanent: best,
      direction: "top",
      offset: [0, -12],
      className: "geo-label",
    });
    this.group.addLayer(circle).addLayer(dot);
    const drawn: Drawn = { candidate, circle, dot, label };
    this.drawn.set(candidate.id, drawn);
    this.style(drawn, candidate, best);
    if (animate) this.tween(drawn, { ...candidate, radius_m: candidate.radius_m * 2.5 }, candidate);
  }

  private morph(drawn: Drawn, candidate: Candidate, best: boolean, animate: boolean): void {
    const from: Candidate = {
      ...drawn.candidate,
      lat: drawn.circle.getLatLng().lat,
      lng: drawn.circle.getLatLng().lng,
      radius_m: drawn.circle.getRadius(),
    };
    this.style(drawn, candidate, best);
    if (animate) this.tween(drawn, from, candidate);
    else this.place(drawn, candidate.lat, candidate.lng, candidate.radius_m);
    drawn.candidate = candidate;
  }

  private style(drawn: Drawn, candidate: Candidate, best: boolean): void {
    drawn.circle.setStyle(circleStyle(candidate, best));
    drawn.dot.setIcon(dotIcon(candidate, best));
    drawn.dot.setZIndexOffset(best ? 1000 : 0);
    drawn.label.textContent = this.format(candidate);
    const tooltip = drawn.dot.getTooltip();
    if (tooltip && tooltip.options.permanent !== best) {
      drawn.dot.unbindTooltip();
      drawn.dot.bindTooltip(drawn.label, {
        permanent: best,
        direction: "top",
        offset: [0, -12],
        className: "geo-label",
      });
    }
  }

  /** Interpolates position linearly and radius logarithmically, so zooming in feels steady. */
  private tween(drawn: Drawn, from: Candidate, to: Candidate): void {
    if (drawn.frame) cancelAnimationFrame(drawn.frame);
    const start = performance.now();
    const logFrom = Math.log(from.radius_m);
    const logTo = Math.log(to.radius_m);
    const step = (now: number) => {
      const k = easeOutCubic(Math.min(1, (now - start) / TWEEN_MS));
      this.place(
        drawn,
        from.lat + (to.lat - from.lat) * k,
        from.lng + (to.lng - from.lng) * k,
        Math.exp(logFrom + (logTo - logFrom) * k),
      );
      drawn.frame = k < 1 ? requestAnimationFrame(step) : undefined;
    };
    drawn.frame = requestAnimationFrame(step);
  }

  private place(drawn: Drawn, lat: number, lng: number, radius: number): void {
    const center = L.latLng(lat, lng);
    drawn.circle.setLatLng(center).setRadius(radius);
    drawn.dot.setLatLng(center);
  }

  private removeDrawn(id: string, drawn: Drawn, animate: boolean): void {
    this.drawn.delete(id);
    if (drawn.frame) cancelAnimationFrame(drawn.frame);
    const remove = () => this.group.removeLayer(drawn.circle).removeLayer(drawn.dot);
    if (!animate) return void remove();
    drawn.circle.setStyle({ opacity: 0, fillOpacity: 0 });
    drawn.dot.setOpacity(0);
    setTimeout(remove, FADE_MS);
  }
}
