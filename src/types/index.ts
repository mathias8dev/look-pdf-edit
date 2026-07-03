export type Rotation = 0 | 90 | 180 | 270;

/**
 * One page in the working document. `srcIndex` points at the page's
 * position in the ORIGINAL uploaded PDF (0-based). The order of the
 * `pages` array in the store is the output order; deleting a page just
 * removes its item. Rotation is the user-applied delta on top of the
 * page's intrinsic rotation.
 */
export interface PageItem {
  id: string;
  srcIndex: number;
  rotation: Rotation;
}
