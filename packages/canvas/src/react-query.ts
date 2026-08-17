/**
 * TanStack Query hooks for Denovo Canvas storage persistence.
 *
 * Provides React Query integration for document storage operations:
 * - Loading documents
 * - Listing documents
 * - Saving documents
 * - Deleting documents
 * - Applying commands
 * - Uploading assets
 *
 * @example
 * ```tsx
 * import { useCanvasDocument, useCanvasDocumentSave } from "@denovo/canvas/react-query";
 *
 * function CanvasEditor({ documentId }: { documentId: string }) {
 *   const { data: document, isLoading } = useCanvasDocument(adapter, documentId);
 *   const saveMutation = useCanvasDocumentSave(adapter);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!document) return <div>Document not found</div>;
 *
 *   return (
 *     <DenovoCanvas document={document} />
 *   );
 * }
 * ```
 */

import {
  type CanvasCommand,
  type CanvasDocument,
  type CanvasDocumentSummary,
  type CanvasSaveResult,
  type AssetUpload,
  type AssetRef
} from "@denovo/canvas-core";
import {
  type CanvasStorageAdapter
} from "@denovo/canvas-core";
import {
  type UseMutationOptions,
  type UseQueryOptions,
  type UseSuspenseQueryOptions,
  useMutation,
  useQuery,
  useSuspenseQuery
} from "@tanstack/react-query";

/**
 * Query key factory for canvas storage queries.
 */
export const canvasQueryKeys = {
  all: ["canvas"] as const,
  documents: (adapter: CanvasStorageAdapter) =>
    [...canvasQueryKeys.all, adapter.name, "documents"] as const,
  document: (adapter: CanvasStorageAdapter, documentId: string) =>
    [...canvasQueryKeys.documents(adapter), documentId] as const,
  documentList: (adapter: CanvasStorageAdapter) =>
    [...canvasQueryKeys.documents(adapter), "list"] as const
};

/**
 * Options for useCanvasDocument hook.
 */
export type UseCanvasDocumentOptions = Omit<
  UseQueryOptions<CanvasDocument | null>,
  "queryKey" | "queryFn"
>;

/**
 * Hook to load a canvas document by ID from storage.
 *
 * @param adapter - The storage adapter to use
 * @param documentId - The document ID to load
 * @param options - React Query options
 * @returns Query result with document data or null
 *
 * @example
 * ```tsx
 * const { data: document, isLoading, error } = useCanvasDocument(adapter, "doc-123");
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error loading document</div>;
 * if (!document) return <div>Document not found</div>;
 *
 * return <DenovoCanvas document={document} />;
 * ```
 */
export function useCanvasDocument(
  adapter: CanvasStorageAdapter,
  documentId: string,
  options: UseCanvasDocumentOptions = {}
) {
  return useQuery({
    ...options,
    queryKey: canvasQueryKeys.document(adapter, documentId),
    queryFn: () => adapter.loadDocument(documentId),
    enabled: options.enabled ?? Boolean(documentId && adapter)
  });
}

/**
 * Options for useCanvasDocumentSuspense hook.
 */
export type UseCanvasDocumentSuspenseOptions = Omit<
  UseSuspenseQueryOptions<CanvasDocument>,
  "queryKey" | "queryFn"
>;

/**
 * Suspense-enabled hook to load a canvas document by ID.
 * Throws a promise if the document is not yet loaded, enabling React Suspense boundaries.
 *
 * @param adapter - The storage adapter to use
 * @param documentId - The document ID to load
 * @param options - React Query suspense options
 * @returns Suspended query result with document data (never null)
 *
 * @example
 * ```tsx
 * function DocumentViewer({ documentId }: { documentId: string }) {
 *   const { data: document } = useCanvasDocumentSuspense(adapter, documentId);
 *
 *   return <DenovoCanvas document={document} />;
 * }
 *
 * function App() {
 *   return (
 *     <Suspense fallback={<div>Loading...</div>}>
 *       <DocumentViewer documentId="doc-123" />
 *     </Suspense>
 *   );
 * }
 * ```
 */
export function useCanvasDocumentSuspense(
  adapter: CanvasStorageAdapter,
  documentId: string,
  options: UseCanvasDocumentSuspenseOptions = {}
) {
  const result = useSuspenseQuery({
    ...options,
    queryKey: canvasQueryKeys.document(adapter, documentId),
    queryFn: async () => {
      const document = await adapter.loadDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }
      return document;
    }
  });

  return result;
}

/**
 * Options for useCanvasDocumentList hook.
 */
export type UseCanvasDocumentListOptions = Omit<
  UseQueryOptions<CanvasDocumentSummary[]>,
  "queryKey" | "queryFn"
>;

/**
 * Hook to list all available canvas documents from storage.
 *
 * @param adapter - The storage adapter to use
 * @param options - React Query options
 * @returns Query result with array of document summaries
 *
 * @example
 * ```tsx
 * const { data: documents, isLoading } = useCanvasDocumentList(adapter);
 *
 * return (
 *   <ul>
 *     {documents?.map(doc => (
 *       <li key={doc.id}>{doc.title || 'Untitled'}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useCanvasDocumentList(
  adapter: CanvasStorageAdapter,
  options: UseCanvasDocumentListOptions = {}
) {
  return useQuery({
    ...options,
    queryKey: canvasQueryKeys.documentList(adapter),
    queryFn: () => {
      if (!adapter.listDocuments) {
        return [];
      }
      return adapter.listDocuments();
    },
    enabled: (options.enabled ?? true) && Boolean(adapter.listDocuments)
  });
}

/**
 * Options for useCanvasDocumentSave hook.
 */
export type UseCanvasDocumentSaveOptions = Omit<
  UseMutationOptions<
    CanvasSaveResult,
    Error,
    {
      document: CanvasDocument;
      baseRevision?: number;
    }
  >,
  "mutationFn"
>;

/**
 * Hook to save a canvas document to storage.
 *
 * @param adapter - The storage adapter to use
 * @param options - React Query mutation options
 * @returns Mutation with save operation
 *
 * @example
 * ```tsx
 * const saveMutation = useCanvasDocumentSave(adapter);
 *
 * const handleSave = (updatedDocument: CanvasDocument) => {
 *   saveMutation.mutate(
 *     { document: updatedDocument, baseRevision: 5 },
 *     {
 *       onSuccess: (result) => {
 *         console.log('Saved with revision:', result.revision);
 *       }
 *     }
 *   );
 * };
 * ```
 */
export function useCanvasDocumentSave(
  adapter: CanvasStorageAdapter,
  options: UseCanvasDocumentSaveOptions = {}
) {
  return useMutation({
    ...options,
    mutationFn: ({ document, baseRevision }: { document: CanvasDocument; baseRevision?: number }) =>
      adapter.saveDocument(document, baseRevision === undefined ? {} : { baseRevision })
  });
}

/**
 * Options for useCanvasDocumentDelete hook.
 */
export type UseCanvasDocumentDeleteOptions = Omit<
  UseMutationOptions<boolean, Error, string>,
  "mutationFn"
>;

/**
 * Hook to delete a canvas document from storage.
 *
 * @param adapter - The storage adapter to use
 * @param options - React Query mutation options
 * @returns Mutation with delete operation
 *
 * @example
 * ```tsx
 * const deleteMutation = useCanvasDocumentDelete(adapter);
 *
 * const handleDelete = (documentId: string) => {
 *   deleteMutation.mutate(documentId, {
 *     onSuccess: (deleted) => {
 *       if (deleted) {
 *         console.log('Document deleted');
 *       }
 *     }
 *   });
 * };
 * ```
 */
export function useCanvasDocumentDelete(
  adapter: CanvasStorageAdapter,
  options: UseCanvasDocumentDeleteOptions = {}
) {
  return useMutation({
    ...options,
    mutationFn: (documentId: string) => {
      if (!adapter.deleteDocument) {
        throw new Error("Adapter does not support document deletion");
      }
      return adapter.deleteDocument(documentId);
    }
  });
}

/**
 * Options for useCanvasCommands hook.
 */
export type UseCanvasCommandsOptions = Omit<
  UseMutationOptions<
    CanvasSaveResult,
    Error,
    {
      documentId: string;
      commands: readonly CanvasCommand[];
      baseRevision?: number;
    }
  >,
  "mutationFn"
>;

/**
 * Hook to apply commands to a canvas document in storage.
 *
 * @param adapter - The storage adapter to use
 * @param options - React Query mutation options
 * @returns Mutation with apply commands operation
 *
 * @example
 * ```tsx
 * const commandsMutation = useCanvasCommands(adapter);
 *
 * const handleApplyCommands = (documentId: string) => {
 *   commandsMutation.mutate({
 *     documentId,
 *     commands: [
 *       { type: "createNode", payload: { ... } }
 *     ]
 *   });
 * };
 * ```
 */
export function useCanvasCommands(
  adapter: CanvasStorageAdapter,
  options: UseCanvasCommandsOptions = {}
) {
  return useMutation({
    ...options,
    mutationFn: ({ documentId, commands, baseRevision }: { documentId: string; commands: readonly CanvasCommand[]; baseRevision?: number }) => {
      if (!adapter.applyCommands) {
        throw new Error("Adapter does not support applying commands");
      }
      return adapter.applyCommands(documentId, commands, baseRevision === undefined ? {} : { baseRevision });
    }
  });
}

/**
 * Options for useCanvasAssetUpload hook.
 */
export type UseCanvasAssetUploadOptions = Omit<
  UseMutationOptions<AssetRef, Error, AssetUpload>,
  "mutationFn"
>;

/**
 * Hook to upload an asset for canvas storage.
 *
 * @param adapter - The storage adapter to use
 * @param options - React Query mutation options
 * @returns Mutation with asset upload operation
 *
 * @example
 * ```tsx
 * const uploadMutation = useCanvasAssetUpload(adapter);
 *
 * const handleUpload = async (file: File) => {
 *   const arrayBuffer = await file.arrayBuffer();
 *   uploadMutation.mutate({
 *     asset: { type: "image", id: "img-123" },
 *     data: arrayBuffer
 *   });
 * };
 * ```
 */
export function useCanvasAssetUpload(
  adapter: CanvasStorageAdapter,
  options: UseCanvasAssetUploadOptions = {}
) {
  return useMutation({
    ...options,
    mutationFn: (upload: AssetUpload) => {
      if (!adapter.uploadAsset) {
        throw new Error("Adapter does not support asset uploads");
      }
      return adapter.uploadAsset(upload);
    }
  });
}

/**
 * Combined hook for document editing with automatic save on changes.
 * Connects document loading with optimistic updates and debounced saves.
 *
 * @param adapter - The storage adapter to use
 * @param documentId - The document ID to edit
 * @param options - Options including auto-save configuration
 * @returns Object with document data and save functions
 *
 * @example
 * ```tsx
 * function AutoSavingCanvas({ documentId }: { documentId: string }) {
 *   const { document, save, isSaving } = useCanvasDocumentEditor(adapter, documentId, {
 *     autoSave: true,
 *     autoSaveDelay: 2000
 *   });
 *
 *   const handleChange = (updatedDocument: CanvasDocument) => {
 *     save(updatedDocument);
 *   };
 *
 *   return (
 *     <div>
 *       {isSaving && <div>Saving...</div>}
 *       <DenovoCanvas document={document} onChange={handleChange} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useCanvasDocumentEditor(
  adapter: CanvasStorageAdapter,
  documentId: string,
  options: {
    /** React Query options for document loading */
    query?: UseCanvasDocumentOptions;
    /** React Query options for save mutation */
    mutation?: UseCanvasDocumentSaveOptions;
    /** Enable auto-save on document changes */
    autoSave?: boolean;
    /** Delay in ms before auto-saving (debounce) */
    autoSaveDelay?: number;
  } = {}
) {
  const { query: queryOptions, mutation: mutationOptions, autoSave = false, autoSaveDelay = 1000 } = options;

  const documentQuery = useCanvasDocument(adapter, documentId, queryOptions);
  const saveMutation = useCanvasDocumentSave(adapter, mutationOptions);

  return {
    document: documentQuery.data,
    isLoading: documentQuery.isLoading,
    error: documentQuery.error,
    save: (document: CanvasDocument, baseRevision?: number) => {
      saveMutation.mutate(baseRevision === undefined ? { document } : { document, baseRevision });
    },
    saveAsync: async (document: CanvasDocument, baseRevision?: number) => {
      return saveMutation.mutateAsync(baseRevision === undefined ? { document } : { document, baseRevision });
    },
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
    autoSave,
    autoSaveDelay
  };
}
