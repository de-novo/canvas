import {
  CanvasDocumentSchema,
  buildPatchRecord,
  defineUploadedAsset,
  readAssetUploadData,
  type CanvasDocument,
  type CanvasDocumentSummary,
  type CanvasStorageAdapter,
  type DocumentPatchRecord,
  type NodeId,
  type AssetRef
} from "@denovo/canvas-core";
import { applyCommandsToStoredDocument } from "@denovo/canvas-editor";

const DEFAULT_DB_NAME = "denovo-canvas";
const DEFAULT_STORE_NAME = "documents";
const PATCHES_STORE_NAME = "patches";
const ASSETS_STORE_NAME = "assets";
const DB_VERSION = 2;

type StoredEntry = { id: string; document: CanvasDocument; revision: number };
type StoredPatch = DocumentPatchRecord;
type StoredAsset = {
  id: string;
  asset: AssetRef;
  data: ArrayBuffer;
  createdAt: string;
};

export type IndexedDbDocumentAdapterOptions = {
  /** IndexedDB database name. Defaults to `denovo-canvas`. */
  dbName?: string;
  /** Object store name inside the database. Defaults to `documents`. */
  storeName?: string;
};

/**
 * Browser `CanvasStorageAdapter` backed by IndexedDB. Each document is stored
 * as a record keyed by document id. Optimistic-concurrency conflict detection
 * uses the stored `revision` against `baseRevision`, matching the in-memory and
 * filesystem adapters.
 *
 * This module uses the browser IndexedDB API and is meant for browser bundles
 * only; it is published under the `@denovo/canvas-web/indexed-db` export.
 */
export function createIndexedDbDocumentAdapter(
  options: IndexedDbDocumentAdapterOptions = {}
): CanvasStorageAdapter {
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;

  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = request.result;

          // Create documents store if it doesn't exist
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }

          // Create patches store for audit log
          if (!db.objectStoreNames.contains(PATCHES_STORE_NAME)) {
            db.createObjectStore(PATCHES_STORE_NAME, { keyPath: "id" });
          }

          // Create assets store for binary data
          if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) {
            db.createObjectStore(ASSETS_STORE_NAME, { keyPath: "id" });
          }
        };
      });
    }

    return dbPromise;
  };

  const readStored = async (
    db: IDBDatabase,
    id: NodeId
  ): Promise<StoredEntry | null> => {
    return new Promise<StoredEntry | null>((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as StoredEntry | undefined;
        resolve(result ?? null);
      };
    });
  };

  return {
    name: "indexed-db",

    async loadDocument(id) {
      const db = await getDb();
      const stored = await readStored(db, id);

      if (!stored) {
        return null;
      }

      try {
        return CanvasDocumentSchema.parse(stored.document);
      } catch {
        return null;
      }
    },

    async saveDocument(document, saveOptions) {
      const db = await getDb();
      const existing = await readStored(db, document.id);
      const baseRevision = saveOptions?.baseRevision;

      if (
        existing &&
        baseRevision !== undefined &&
        baseRevision !== existing.revision
      ) {
        return {
          ok: false as const,
          reason: "conflict" as const,
          serverRevision: existing.revision,
          document: existing.document
        };
      }

      const nextRevision = (existing?.revision ?? document.revision ?? 0) + 1;
      const parsed = CanvasDocumentSchema.parse({
        ...document,
        revision: nextRevision
      });
      const entry: StoredEntry = {
        id: parsed.id,
        document: parsed,
        revision: nextRevision
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(entry);
        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
      });

      return {
        ok: true as const,
        document: parsed,
        revision: nextRevision
      };
    },

    async listDocuments() {
      const db = await getDb();

      return new Promise<CanvasDocumentSummary[]>((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entries = request.result as StoredEntry[];
          resolve(
            entries.map((entry) => ({
              id: entry.document.id,
              schemaVersion: entry.document.schemaVersion,
              ...(entry.document.title === undefined
                ? {}
                : { title: entry.document.title }),
              ...(entry.document.updatedAt === undefined
                ? {}
                : { updatedAt: entry.document.updatedAt })
            }))
          );
        };
      });
    },

    async deleteDocument(id) {
      const db = await getDb();

      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const request = tx.objectStore(storeName).delete(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    },

    async applyCommands(documentId, commands, options) {
      const db = await getDb();
      const existing = await readStored(db, documentId);
      const createdAt = new Date().toISOString();
      const result = await applyCommandsToStoredDocument(
        existing === null
          ? null
          : { document: existing.document, revision: existing.revision },
        documentId,
        commands,
        {
          ...(options?.baseRevision === undefined
            ? {}
            : { baseRevision: options.baseRevision }),
          now: () => createdAt
        }
      );

      if (!result.ok) {
        return result;
      }

      // Serialize the commands into a DocumentPatchRecord with a real patch.
      // The patch describes each command's structural effect on the document
      // (scene.nodes, scene.layers, selection) so the audit log can be
      // replayed or reasoned about by a server / offline layer.
      const soleCommand = commands.length === 1 ? commands[0] : undefined;
      const commandType =
        soleCommand !== undefined
          ? soleCommand.type
          : commands.length > 1
            ? "transaction"
            : undefined;

      const patchRecord: StoredPatch = buildPatchRecord({
        id: `patch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        documentId,
        baseRevision: result.revision - 1,
        revision: result.revision,
        commands,
        createdAt,
        ...(commandType === undefined ? {} : { commandType })
      });

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([storeName, PATCHES_STORE_NAME], "readwrite");

        const patchesStore = tx.objectStore(PATCHES_STORE_NAME);
        const patchRequest = patchesStore.put(patchRecord);
        patchRequest.onerror = () => reject(patchRequest.error);

        const updatedEntry: StoredEntry = {
          id: result.document.id,
          document: result.document,
          revision: result.revision
        };

        const docsStore = tx.objectStore(storeName);
        docsStore.put(updatedEntry);

        tx.onerror = () => reject(tx.error);
        tx.oncomplete = () => resolve();
      });

      return result;
    },

    async uploadAsset(upload) {
      const db = await getDb();
      const data = await readAssetUploadData(upload.data);
      const draftId =
        typeof upload.asset.id === "string" && upload.asset.id.length > 0
          ? upload.asset.id
          : `asset-${Date.now().toString(36)}`;
      const asset = defineUploadedAsset(upload, data, `indexeddb://${draftId}`);
      const storedAsset: StoredAsset = {
        id: asset.id,
        asset,
        data,
        createdAt: new Date().toISOString()
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(ASSETS_STORE_NAME, "readwrite");
        const request = tx.objectStore(ASSETS_STORE_NAME).put(storedAsset);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        tx.oncomplete = () => resolve();
      });

      return asset;
    },

    async loadAsset(id) {
      const db = await getDb();

      return new Promise<
        { asset: AssetRef; data: ArrayBuffer } | null
      >((resolve, reject) => {
        const tx = db.transaction(ASSETS_STORE_NAME, "readonly");
        const request = tx.objectStore(ASSETS_STORE_NAME).get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as StoredAsset | undefined;
          if (result === undefined) {
            resolve(null);
            return;
          }

          resolve({ asset: result.asset, data: result.data });
        };
      });
    }
  };
}

export type { CanvasStorageAdapter } from "@denovo/canvas-core";
