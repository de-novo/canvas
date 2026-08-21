import {
  CanvasDocumentSchema,
  type AssetRecord,
  type AssetRef,
  type AssetUpload,
  type CanvasCommand,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasDocumentSummary,
  type CanvasSaveResult,
  type CanvasStorageAdapter,
  type NodeId
} from "@denovo/canvas-core";
import { applyCommandsToStoredDocument } from "@denovo/canvas-editor";
import {
  storeUploadedAsset,
  storedAssetRecord,
  type StoredAssetBlob
} from "./asset-blob.js";

type StoredDocument = {
  document: CanvasDocument;
  revision: number;
};

/**
 * In-memory `CanvasStorageAdapter` for tests and demos. Keeps a `Map` of
 * document id → `{ document, revision }` and enforces optimistic-concurrency
 * conflict detection via `baseRevision`.
 *
 * `applyCommands` uses the editor command applier (`applyCommandsToStoredDocument`)
 * so memory, filesystem, and IndexedDB share OCC and revision rules.
 * `uploadAsset` / `loadAsset` keep blobs beside the document map.
 */
export function createMemoryDocumentAdapter(
  initial: readonly CanvasDocumentInput[] = []
): CanvasStorageAdapter {
  const store = new Map<NodeId, StoredDocument>();
  const assets = new Map<NodeId, StoredAssetBlob>();

  for (const input of initial) {
    const document = CanvasDocumentSchema.parse(input);
    store.set(document.id, {
      document,
      revision: document.revision
    });
  }

  return {
    name: "memory",

    async loadDocument(id) {
      const stored = store.get(id);
      return stored ? stored.document : null;
    },

    async saveDocument(document, options) {
      const stored = store.get(document.id);
      const baseRevision = options?.baseRevision;

      if (
        stored &&
        baseRevision !== undefined &&
        baseRevision !== stored.revision
      ) {
        return {
          ok: false as const,
          reason: "conflict" as const,
          serverRevision: stored.revision,
          document: stored.document
        };
      }

      const nextRevision = (stored?.revision ?? document.revision ?? 0) + 1;
      const parsed = CanvasDocumentSchema.parse({
        ...document,
        revision: nextRevision
      });

      store.set(parsed.id, {
        document: parsed,
        revision: nextRevision
      });

      return {
        ok: true as const,
        document: parsed,
        revision: nextRevision
      };
    },

    async listDocuments() {
      return [...store.values()].map((stored) => ({
        id: stored.document.id,
        schemaVersion: stored.document.schemaVersion,
        ...(stored.document.title === undefined
          ? {}
          : { title: stored.document.title }),
        ...(stored.document.updatedAt === undefined
          ? {}
          : { updatedAt: stored.document.updatedAt })
      }));
    },

    async deleteDocument(id) {
      return store.delete(id);
    },

    async applyCommands(documentId, commands, options) {
      const stored = store.get(documentId) ?? null;
      const result = await applyCommandsToStoredDocument(
        stored,
        documentId,
        commands,
        options ?? {}
      );

      if (!result.ok) {
        return result;
      }

      store.set(result.document.id, {
        document: result.document,
        revision: result.revision
      });

      return result;
    },

    async uploadAsset(upload) {
      return storeUploadedAsset(
        upload,
        (id) => `memory://${id}`,
        (record) => {
          assets.set(record.asset.id, record);
        }
      );
    },

    async loadAsset(id) {
      return storedAssetRecord(assets.get(id));
    }
  };
}

export type CanvasServerOptions = {
  adapter?: CanvasStorageAdapter;
};

export type CanvasServer = {
  readonly adapter: CanvasStorageAdapter;
  applyCommands: (
    documentId: NodeId,
    commands: readonly CanvasCommand[],
    options?: { baseRevision?: number }
  ) => Promise<CanvasSaveResult>;
  deleteDocument: (id: NodeId) => Promise<boolean>;
  listDocuments: () => Promise<CanvasDocumentSummary[]>;
  loadAsset: (id: NodeId) => Promise<AssetRecord | null>;
  loadDocument: (id: NodeId) => Promise<CanvasDocument | null>;
  saveDocument: (
    document: CanvasDocument,
    options?: { baseRevision?: number }
  ) => Promise<CanvasSaveResult>;
  uploadAsset: (upload: AssetUpload) => Promise<AssetRef>;
};

/**
 * Thin synchronous-looking document CRUD facade over a `CanvasStorageAdapter`.
 * Defaults to an in-memory adapter. Apps that already hold an adapter (e.g. an
 * HTTP or IndexedDB implementation) can pass it via `options.adapter`.
 */
export function createCanvasServer(
  options: CanvasServerOptions = {}
): CanvasServer {
  const adapter = options.adapter ?? createMemoryDocumentAdapter();

  return {
    adapter,

    applyCommands(documentId, commands, saveOptions) {
      const impl = adapter.applyCommands;

      if (!impl) {
        return Promise.resolve({
          ok: false as const,
          reason: "unknown" as const,
          message: `Storage adapter "${adapter.name}" does not support applyCommands.`
        });
      }

      return impl(documentId, commands, saveOptions);
    },

    deleteDocument(id) {
      const impl = adapter.deleteDocument;

      if (!impl) {
        return Promise.resolve(false);
      }

      return impl(id);
    },

    listDocuments() {
      const impl = adapter.listDocuments;

      if (!impl) {
        return Promise.resolve([]);
      }

      return impl();
    },

    loadAsset(id) {
      const impl = adapter.loadAsset;

      if (!impl) {
        return Promise.reject(
          new Error(
            `Storage adapter "${adapter.name}" does not support loadAsset.`
          )
        );
      }

      return impl(id);
    },

    loadDocument(id) {
      return adapter.loadDocument(id);
    },

    saveDocument(document, saveOptions) {
      return adapter.saveDocument(document, saveOptions);
    },

    uploadAsset(upload) {
      const impl = adapter.uploadAsset;

      if (!impl) {
        return Promise.reject(
          new Error(
            `Storage adapter "${adapter.name}" does not support uploadAsset.`
          )
        );
      }

      return impl(upload);
    }
  };
}

export {
  type CanvasDocument,
  type CanvasDocumentSummary,
  type CanvasSaveResult,
  type CanvasStorageAdapter
} from "@denovo/canvas-core";
