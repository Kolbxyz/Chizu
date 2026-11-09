import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { stretchContrast } from "./images.ts";
import { dropUrlImages, toToolContent } from "./urlImages.ts";

describe("URL images", () => {
  it("are replaced by a note, once", () => {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: toToolContent([
              { type: "text", text: "caption" },
              { type: "image", url: "https://upload.wikimedia.org/a.jpg" },
            ]),
          },
        ],
      },
    ];
    expect(dropUrlImages(messages)).toBe(true);
    expect(JSON.stringify(messages)).not.toContain('"type":"url"');
    expect(dropUrlImages(messages)).toBe(false);
  });

  it("are replaced only from the given message on", () => {
    const result = (id: string): Anthropic.Beta.BetaMessageParam => ({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: id,
          content: toToolContent([
            { type: "image", url: `https://upload.wikimedia.org/${id}.jpg` },
          ]),
        },
      ],
    });
    const messages = [result("old"), { role: "assistant", content: "…" } as const, result("new")];
    expect(dropUrlImages(messages, 2)).toBe(true);
    expect(JSON.stringify(messages[0])).toContain('"type":"url"');
    expect(JSON.stringify(messages[2])).not.toContain('"type":"url"');
  });
});

describe("stretchContrast", () => {
  it("maps a narrow grey range to black and white", () => {
    const pixels = new Uint8ClampedArray(400);
    for (let i = 0; i < 100; i += 1)
      pixels.set([i < 50 ? 100 : 140, i < 50 ? 100 : 140, i < 50 ? 100 : 140, 255], i * 4);
    stretchContrast(pixels);
    expect(pixels[0]).toBe(0);
    expect(pixels[396]).toBe(255);
    expect(pixels[3]).toBe(255);
  });
});
