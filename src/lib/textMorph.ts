// "Magic move" for text rewritten by a language switch. React updates text nodes
// in place; a MutationObserver records each node's previous value. For every
// visible changed node, the position of each character is measured in the old
// and the new text. The real text is hidden through the CSS Custom Highlight API
// while copies of the characters animate: letters shared by both strings (longest
// common subsequence) slide to their new place, removed letters fade out and new
// letters fade in.

const MOVE_MS = 460;
const FADE_OUT_MS = 200;
const FADE_IN_MS = 260;
const FADE_IN_DELAY_MS = 140;
/** How long after the switch React's text updates are collected. */
const CAPTURE_MS = 250;
/** Longer texts (Claude's prose) are not translated by the switch and are skipped. */
const MAX_LENGTH = 160;
const MAX_NODES = 150;
const HIGHLIGHT = "chizu-morph";
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

interface Glyph {
  char: string;
  rect: DOMRect;
}

/** Runs `change` (a state update) and animates the text nodes it rewrites under `root`. */
export function morphTextChanges(root: HTMLElement, change: () => void): void {
  const supported =
    typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function";
  if (!supported || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    change();
    return;
  }
  const handled = new WeakSet<Text>();
  const observer = new MutationObserver((records) => {
    const changes = new Map<Text, string>();
    for (const record of records) {
      const node = record.target;
      if (!(node instanceof Text) || record.oldValue === null || handled.has(node)) continue;
      handled.add(node);
      if (!changes.has(node)) changes.set(node, record.oldValue);
    }
    animate(changes);
  });
  observer.observe(root, { subtree: true, characterData: true, characterDataOldValue: true });
  setTimeout(() => observer.disconnect(), CAPTURE_MS);
  change();
}

function animate(changes: Map<Text, string>): void {
  const nodes = [...changes].filter(
    ([node, old]) => old !== node.data && node.data.length <= MAX_LENGTH && isVisible(node),
  );
  if (nodes.length === 0) return;
  nodes.length = Math.min(nodes.length, MAX_NODES);

  // Measure every old layout first, then every new one, so nodes do not disturb each other.
  const next = nodes.map(([node]) => node.data);
  nodes.forEach(([node, old]) => (node.data = old));
  const before = nodes.map(([node]) => measure(node));
  nodes.forEach(([node], i) => (node.data = next[i] ?? node.data));
  const after = nodes.map(([node]) => measure(node));

  const layer = document.createElement("div");
  layer.className = "text-morph";
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);

  const hidden = new Highlight();
  nodes.forEach(([node], i) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    hidden.add(range);
    const parent = node.parentElement;
    if (parent) drawNode(layer, parent, before[i] ?? [], after[i] ?? []);
  });
  CSS.highlights.set(HIGHLIGHT, hidden);

  setTimeout(() => {
    CSS.highlights.delete(HIGHLIGHT);
    layer.remove();
  }, MOVE_MS + 40);
}

function drawNode(layer: HTMLElement, parent: HTMLElement, from: Glyph[], to: Glyph[]): void {
  const style = getComputedStyle(parent);
  const pairs = keepRuns(matchCharacters(from, to));
  const matchedFrom = new Set(pairs.map(([i]) => i));
  const matchedTo = new Map(pairs.map(([i, j]) => [j, i]));

  to.forEach((glyph, j) => {
    const source = matchedTo.get(j);
    const span = glyphSpan(layer, style, glyph);
    if (source === undefined) {
      span.animate(
        [
          { opacity: 0, transform: "translateY(0.25em)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: FADE_IN_MS, delay: FADE_IN_DELAY_MS + j * 6, easing: EASE, fill: "both" },
      );
      return;
    }
    const start = from[source];
    if (!start) return;
    const dx = start.rect.left - glyph.rect.left;
    const dy = start.rect.top - glyph.rect.top;
    span.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
      duration: MOVE_MS,
      easing: EASE,
      fill: "both",
    });
  });

  from.forEach((glyph, i) => {
    if (matchedFrom.has(i)) return;
    glyphSpan(layer, style, glyph).animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(-0.25em)" },
      ],
      { duration: FADE_OUT_MS, easing: EASE, fill: "both" },
    );
  });
}

function glyphSpan(layer: HTMLElement, style: CSSStyleDeclaration, glyph: Glyph): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = glyph.char;
  Object.assign(span.style, {
    left: `${glyph.rect.left}px`,
    top: `${glyph.rect.top}px`,
    height: `${glyph.rect.height}px`,
    lineHeight: `${glyph.rect.height}px`,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    fontFeatureSettings: style.fontFeatureSettings,
    color: style.color,
  });
  layer.append(span);
  return span;
}

/** Viewport rectangle of every visible character of a text node. */
function measure(node: Text): Glyph[] {
  const glyphs: Glyph[] = [];
  const range = document.createRange();
  for (let i = 0; i < node.data.length; i += 1) {
    const char = node.data[i] ?? "";
    if (!char.trim()) continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) glyphs.push({ char, rect });
  }
  return glyphs;
}

function isVisible(node: Text): boolean {
  const range = document.createRange();
  range.selectNodeContents(node);
  const rect = range.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.bottom > 0 &&
    rect.top < innerHeight &&
    rect.right > 0 &&
    rect.left < innerWidth
  );
}

/** Order-preserving character matches (longest common subsequence), case-insensitive. */
export function matchCharacters(
  from: Glyph[] | string[],
  to: Glyph[] | string[],
): Array<[number, number]> {
  const key = (g: Glyph | string) => (typeof g === "string" ? g : g.char).toLowerCase();
  const a = from.map(key);
  const b = to.map(key);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i]!;
      row[j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, row[j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return pairs;
}

/**
 * Keeps matches that belong to runs of at least two consecutive characters, so
 * whole fragments ("photos") slide while isolated shared letters fade instead of
 * flying across the text.
 */
export function keepRuns(pairs: Array<[number, number]>): Array<[number, number]> {
  const linked = (a?: [number, number], b?: [number, number]) =>
    a !== undefined && b !== undefined && b[0] === a[0] + 1 && b[1] === a[1] + 1;
  return pairs.filter((pair, k) => linked(pairs[k - 1], pair) || linked(pair, pairs[k + 1]));
}
