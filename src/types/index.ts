export type Rotation = 0 | 90 | 180 | 270;

/**
 * One page in the working document. `docId` names the source document the
 * page came from (assembly can mix pages from several uploaded PDFs) and
 * `srcIndex` is its 0-based position in that source. The order of the `pages`
 * array in the store is the output order; deleting a page just removes its
 * item. Rotation is the user-applied delta on top of the page's intrinsic
 * rotation.
 */
export interface PageItem {
  id: string;
  docId: string;
  srcIndex: number;
  rotation: Rotation;
}

// --- Annotations -----------------------------------------------------------
//
// All annotation geometry is stored in PDF space: origin BOTTOM-LEFT, y-up,
// units = PDF points, relative to the UNROTATED page. This lets annotations
// survive zoom exactly and rotate with the page on export. See lib/pdf/coords.

export type AnnotationKind = "text" | "highlight" | "rect" | "draw" | "image";

export type ToolId = "select" | AnnotationKind | "signature";

interface AnnotationBase {
  id: string;
  /** Id of the PageItem this annotation is attached to. */
  pageId: string;
  kind: AnnotationKind;
}

export interface TextAnnotation extends AnnotationBase {
  kind: "text";
  /** Top-left of the text box, in PDF points. */
  x: number;
  y: number;
  text: string;
  fontSize: number; // PDF points
  color: string; // #rrggbb
}

export interface RectAnnotation extends AnnotationBase {
  kind: "rect";
  /** Bottom-left corner + size, in PDF points. */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // stroke colour
  strokeWidth: number;
}

export interface HighlightAnnotation extends AnnotationBase {
  kind: "highlight";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // fill colour
  opacity: number; // 0..1
}

export interface DrawAnnotation extends AnnotationBase {
  kind: "draw";
  /** Flat [x0,y0,x1,y1,…] polyline in PDF points. */
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface ImageAnnotation extends AnnotationBase {
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  /** data:image/png|jpeg;base64,… */
  dataUrl: string;
}

export type Annotation =
  | TextAnnotation
  | RectAnnotation
  | HighlightAnnotation
  | DrawAnnotation
  | ImageAnnotation;
