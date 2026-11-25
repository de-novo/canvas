/**
 * Re-export of the browser IndexedDB storage adapter from `@de-novo/canvas-web`,
 * so consumers of the facade can import everything from `@de-novo/canvas`.
 *
 * @example
 * ```ts
 * import { createIndexedDbDocumentAdapter } from "@de-novo/canvas/indexed-db";
 * ```
 */
export {
  createIndexedDbDocumentAdapter,
  type IndexedDbDocumentAdapterOptions
} from "@de-novo/canvas-web/indexed-db";
