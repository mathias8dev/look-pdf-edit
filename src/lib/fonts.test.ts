import { describe, it, expect } from "vitest";
import {
  standardFontKey,
  embeddedFontUrl,
  fontStyle,
  fontCss,
  embeddedFontFaces,
} from "./fonts";

describe("font resolution", () => {
  it("maps standard fonts to StandardFonts variant keys per style", () => {
    expect(standardFontKey("helvetica")).toBe("Helvetica");
    expect(standardFontKey("helvetica", true)).toBe("HelveticaBold");
    expect(standardFontKey("helvetica", false, true)).toBe("HelveticaOblique");
    expect(standardFontKey("helvetica", true, true)).toBe("HelveticaBoldOblique");
    expect(standardFontKey("times", true, true)).toBe("TimesRomanBoldItalic");
    expect(standardFontKey("courier", false, true)).toBe("CourierOblique");
  });

  it("returns null standardFontKey for embedded (google) fonts", () => {
    expect(standardFontKey("roboto")).toBeNull();
    expect(standardFontKey("lora", true, true)).toBeNull();
  });

  it("builds the self-hosted woff2 url per style for embedded fonts", () => {
    expect(embeddedFontUrl("roboto")).toBe("/fonts/roboto-400.woff2");
    expect(embeddedFontUrl("roboto", true)).toBe("/fonts/roboto-700.woff2");
    expect(embeddedFontUrl("lora", false, true)).toBe("/fonts/lora-400i.woff2");
    expect(embeddedFontUrl("montserrat", true, true)).toBe("/fonts/montserrat-700i.woff2");
  });

  it("returns null embeddedFontUrl for standard fonts", () => {
    expect(embeddedFontUrl("helvetica")).toBeNull();
  });

  it("falls back to the default (Helvetica) for unknown/undefined ids", () => {
    expect(standardFontKey(undefined)).toBe("Helvetica");
    // @ts-expect-error runtime fallback for a bad id
    expect(standardFontKey("bogus")).toBe("Helvetica");
    expect(fontCss(undefined)).toContain("Helvetica");
  });

  it("composes fontStyle from bold/italic", () => {
    expect(fontStyle()).toBe("normal");
    expect(fontStyle(true)).toBe("bold");
    expect(fontStyle(false, true)).toBe("italic");
    expect(fontStyle(true, true)).toBe("bold italic");
  });

  it("lists every embedded @font-face for preloading", () => {
    // 3 google families x 2 weights x 2 styles
    expect(embeddedFontFaces()).toHaveLength(12);
  });
});
