/**
 * Re-export of the browser IndexedDB storage adapter from `@denovo/canvas-web`,
 * so consumers of the facade can import everything from `@denovo/canvas`.
 *
 * @example
 * ```ts
 * import { createIndexedDbDocumentAdapter } from "@denovo/canvas/indexed-db";
 * ```
 */
export {
  createIndexedDbDocumentAdapter,
  type IndexedDbDocumentAdapterOptions
} from "@denovo/canvas-web/indexed-db";
