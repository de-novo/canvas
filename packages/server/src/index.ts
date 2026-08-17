import {
  CanvasDocumentSchema,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasDocumentSummary,
  type CanvasSaveResult,
  type CanvasStorageAdapter,
  type NodeId
} from "@denovo/canvas-core";

type StoredDocument = {
  document: CanvasDocument;
  revision: number;
};

/**
 * In-memory `CanvasStorageAdapter` for tests and demos. Keeps a `Map` of
 * document id → `{ document, revision }` and enforces optimistic-concurrency
 * conflict detection via `baseRevision`.
 *
 * `applyCommands` and `uploadAsset` are intentionally omitted in M6 Phase A:
 * applying commands needs the editor's command applier (Phase B wiring), and
 * asset upload needs a real blob store (Phase C).
 */
export function createMemoryDocumentAdapter(
  initial: readonly CanvasDocumentInput[] = []
): CanvasStorageAdapter {
  const store = new Map<NodeId, StoredDocument>();

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
    }
  };
}

export type CanvasServerOptions = {
  adapter?: CanvasStorageAdapter;
};

export type CanvasServer = {
  readonly adapter: CanvasStorageAdapter;
  deleteDocument: (id: NodeId) => Promise<boolean>;
  listDocuments: () => Promise<CanvasDocumentSummary[]>;
  loadDocument: (id: NodeId) => Promise<CanvasDocument | null>;
  saveDocument: (
    document: CanvasDocument,
    options?: { baseRevision?: number }
  ) => Promise<CanvasSaveResult>;
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

    loadDocument(id) {
      return adapter.loadDocument(id);
    },

    saveDocument(document, saveOptions) {
      return adapter.saveDocument(document, saveOptions);
    }
  };
}

export {
  type CanvasDocument,
  type CanvasDocumentSummary,
  type CanvasSaveResult,
  type CanvasStorageAdapter
} from "@denovo/canvas-core";
