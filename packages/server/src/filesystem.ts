import { promises as fs } from "node:fs";
import path from "node:path";

import {
  CanvasDocumentSchema,
  type CanvasDocument,
  type CanvasDocumentSummary,
  type CanvasStorageAdapter,
  type NodeId
} from "@denovo/canvas-core";

export type FileSystemDocumentAdapterOptions = {
  /** Directory where document JSON files are read and written. */
  directory: string;
};

/**
 * Node.js filesystem `CanvasStorageAdapter`. Each document is stored as
 * `<directory>/<id>.json`. Optimistic-concurrency conflict detection uses the
 * stored file's `revision` against `baseRevision`, matching the in-memory
 * adapter.
 *
 * Browser builds should not import this module (it uses `node:fs`); it is
 * published under the `@denovo/canvas-server/filesystem` export so bundlers can
 * keep it out of browser bundles.
 */
export function createFileSystemDocumentAdapter(
  options: FileSystemDocumentAdapterOptions
): CanvasStorageAdapter {
  const { directory } = options;
  const documentPath = (id: NodeId) => path.join(directory, `${id}.json`);

  const readStored = async (
    id: NodeId
  ): Promise<CanvasDocument | null> => {
    try {
      const content = await fs.readFile(documentPath(id), "utf8");
      return CanvasDocumentSchema.parse(JSON.parse(content));
    } catch {
      return null;
    }
  };

  return {
    name: "filesystem",

    async loadDocument(id) {
      return readStored(id);
    },

    async saveDocument(document, saveOptions) {
      const existing = await readStored(document.id);
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
          document: existing
        };
      }

      const nextRevision = (existing?.revision ?? document.revision ?? 0) + 1;
      const parsed = CanvasDocumentSchema.parse({
        ...document,
        revision: nextRevision
      });

      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        documentPath(document.id),
        `${JSON.stringify(parsed, null, 2)}\n`,
        "utf8"
      );

      return {
        ok: true as const,
        document: parsed,
        revision: nextRevision
      };
    },

    async listDocuments() {
      try {
        const entries = await fs.readdir(directory);
        const summaries: CanvasDocumentSummary[] = [];

        for (const entry of entries) {
          if (!entry.endsWith(".json")) {
            continue;
          }

          try {
            const content = await fs.readFile(
              path.join(directory, entry),
              "utf8"
            );
            const document = CanvasDocumentSchema.parse(JSON.parse(content));
            summaries.push({
              id: document.id,
              schemaVersion: document.schemaVersion,
              ...(document.title === undefined ? {} : { title: document.title }),
              ...(document.updatedAt === undefined
                ? {}
                : { updatedAt: document.updatedAt })
            });
          } catch {
            // Skip unreadable / invalid files.
          }
        }

        return summaries;
      } catch {
        return [];
      }
    },

    async deleteDocument(id) {
      try {
        await fs.unlink(documentPath(id));
        return true;
      } catch {
        return false;
      }
    }
  };
}

export type { CanvasSaveResult, CanvasStorageAdapter } from "@denovo/canvas-core";
