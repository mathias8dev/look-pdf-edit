import type { FontId } from "@/types";

export interface FontDef {
  id: FontId;
  label: string;
  /** CSS font-family stack used by the browser / Konva overlay. */
  css: string;
  /**
   * true  -> self-hosted woff2 embedded into the PDF via fontkit.
   * false -> a built-in PDF standard font (no embedding needed).
   */
  embedded: boolean;
}

/**
 * The fonts offered in the text editor. The first three are PDF standard fonts
 * (always available, no download); the rest are self-hosted Google fonts (see
 * public/fonts, vendored from @fontsource — same woff2 drives both the browser
 * preview and the embedded PDF, so they match exactly).
 */
export const FONTS: FontDef[] = [
  { id: "helvetica", label: "Helvetica", css: "Arial, Helvetica, sans-serif", embedded: false },
  { id: "times", label: "Times", css: "'Times New Roman', Times, serif", embedded: false },
  { id: "courier", label: "Courier", css: "'Courier New', Courier, monospace", embedded: false },
  { id: "roboto", label: "Roboto", css: "'Roboto', sans-serif", embedded: true },
  { id: "lora", label: "Lora", css: "'Lora', serif", embedded: true },
  { id: "montserrat", label: "Montserrat", css: "'Montserrat', sans-serif", embedded: true },
];

export const FONT_BY_ID = Object.fromEntries(FONTS.map((f) => [f.id, f])) as Record<
  FontId,
  FontDef
>;

export const DEFAULT_FONT: FontId = "helvetica";

function def(id: FontId | undefined): FontDef {
  return (id && FONT_BY_ID[id]) || FONT_BY_ID[DEFAULT_FONT];
}

/** CSS font-family stack for a font id (for Konva / the browser). */
export function fontCss(id: FontId | undefined): string {
  return def(id).css;
}

/** Konva/CSS fontStyle string from bold/italic flags. */
export function fontStyle(bold?: boolean, italic?: boolean): string {
  return [bold ? "bold" : "", italic ? "italic" : ""].join(" ").trim() || "normal";
}

// Standard-font id -> [regular, bold, italic, boldItalic] as StandardFonts keys.
const STANDARD_VARIANTS: Partial<Record<FontId, [string, string, string, string]>> = {
  helvetica: ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"],
  times: ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"],
  courier: ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"],
};

/** For a standard font, the StandardFonts enum key for the given style; else null. */
export function standardFontKey(
  id: FontId | undefined,
  bold?: boolean,
  italic?: boolean,
): string | null {
  const row = STANDARD_VARIANTS[def(id).id];
  if (!row) return null;
  return row[(bold ? 1 : 0) + (italic ? 2 : 0)];
}

/** For an embedded font, the self-hosted woff2 URL for the given style; else null. */
export function embeddedFontUrl(
  id: FontId | undefined,
  bold?: boolean,
  italic?: boolean,
): string | null {
  const f = def(id);
  if (!f.embedded) return null;
  return `/fonts/${f.id}-${bold ? "700" : "400"}${italic ? "i" : ""}.woff2`;
}

/** Every embedded @font-face descriptor, for preloading via document.fonts. */
export function embeddedFontFaces(): { family: string; weight: number; italic: boolean }[] {
  const faces: { family: string; weight: number; italic: boolean }[] = [];
  for (const f of FONTS) {
    if (!f.embedded) continue;
    for (const weight of [400, 700]) {
      for (const italic of [false, true]) faces.push({ family: f.label, weight, italic });
    }
  }
  return faces;
}
