// Schemas of the data Claude reports through the MCP tools. They are the single
// source of truth: the MCP server validates calls with them, the API server
// re-validates the tool inputs it reads from Claude's output stream, and the
// frontend derives its types from them.
import { z } from "zod";

export const PRECISION_LEVELS = [
  "world",
  "continent",
  "country",
  "region",
  "city",
  "district",
  "street",
  "exact",
] as const;

export const CLUE_CATEGORIES = [
  "metadata",
  "text",
  "architecture",
  "vegetation",
  "terrain",
  "infrastructure",
  "vehicles",
  "people",
  "sun",
  "landmark",
  "search",
  "other",
] as const;

export const candidateShape = {
  id: z
    .string()
    .min(1)
    .max(40)
    .describe('Stable identifier of this hypothesis, reused when refining it (e.g. "lisbon").'),
  label: z.string().min(1).max(120).describe("Human-readable place name."),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z
    .number()
    .min(1)
    .max(20_000_000)
    .describe("Radius of the uncertainty circle in metres."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Probability that the photo lies inside the circle."),
};

export const candidateSchema = z.object(candidateShape);

export const estimateShape = {
  level: z.enum(PRECISION_LEVELS).describe("Precision reached by the best candidate."),
  candidates: z
    .array(candidateSchema)
    .min(1)
    .max(8)
    .describe("Every hypothesis still considered, best first. Replaces the previous set."),
  summary: z.string().max(400).describe("One sentence explaining the current estimate."),
};

export const estimateSchema = z.object(estimateShape);

export const clueShape = {
  category: z.enum(CLUE_CATEGORIES),
  text: z.string().min(1).max(240).describe('The observation, e.g. "Cars drive on the left".'),
  implies: z
    .string()
    .max(160)
    .optional()
    .describe('What the observation suggests, e.g. "UK, Japan, Australia".'),
};

export const clueSchema = z.object(clueShape);

const fraction = z.number().min(0).max(1);

/** zoom_image input; the photo number is checked against the job's photo count. */
export const zoomShape = {
  image: z.number().int().min(1).describe("1-based photo number."),
  x: fraction,
  y: fraction,
  width: fraction.min(0.01),
  height: fraction.min(0.01),
  enhance: z.boolean().optional().describe("Stretch the contrast of hazy or distant details."),
};
export const zoomSchema = z.object(zoomShape);

export type Candidate = z.infer<typeof candidateSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
export type Clue = z.infer<typeof clueSchema>;
export type ZoomRequest = z.infer<typeof zoomSchema>;
export type PrecisionLevel = (typeof PRECISION_LEVELS)[number];
export type ClueCategory = (typeof CLUE_CATEGORIES)[number];
