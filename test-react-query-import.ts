/**
 * Test file to verify TanStack Query hooks imports work correctly
 */

import {
  useCanvasDocument,
  useCanvasDocumentSuspense,
  useCanvasDocumentList,
  useCanvasDocumentSave,
  useCanvasDocumentDelete,
  useCanvasCommands,
  useCanvasAssetUpload,
  useCanvasDocumentEditor,
  canvasQueryKeys
} from "@de-novo/canvas/react-query";

// This is just a compile-time test to ensure all exports are available
console.log("TanStack Query hooks imports successful! ✅");

export type TestImports = {
  // Query hooks
  useCanvasDocument: typeof useCanvasDocument;
  useCanvasDocumentSuspense: typeof useCanvasDocumentSuspense;
  useCanvasDocumentList: typeof useCanvasDocumentList;

  // Mutation hooks
  useCanvasDocumentSave: typeof useCanvasDocumentSave;
  useCanvasDocumentDelete: typeof useCanvasDocumentDelete;
  useCanvasCommands: typeof useCanvasCommands;
  useCanvasAssetUpload: typeof useCanvasAssetUpload;

  // Combined hooks
  useCanvasDocumentEditor: typeof useCanvasDocumentEditor;

  // Query keys
  canvasQueryKeys: typeof canvasQueryKeys;
};
