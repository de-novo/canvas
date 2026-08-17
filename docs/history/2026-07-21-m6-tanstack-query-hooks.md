# TanStack Query Hooks Implementation - M6 Completion

**Date:** 2026-07-21  
**Status:** ✅ Complete

## Overview

Implemented comprehensive TanStack Query hooks for Denovo Canvas storage persistence, providing React Query integration for all document storage operations.

## Implementation Details

### New Package: `@denovo/canvas/react-query`

Created a new module within the `@denovo/canvas` facade that exports TanStack Query hooks:

```typescript
import { useCanvasDocument, useCanvasDocumentSave } from "@denovo/canvas/react-query";
```

### Provided Hooks

#### Document Loading
- `useCanvasDocument(adapter, documentId)` - Load a document by ID
- `useCanvasDocumentSuspense(adapter, documentId)` - Suspense-enabled version
- `useCanvasDocumentList(adapter)` - List all available documents

#### Document Mutations
- `useCanvasDocumentSave(adapter)` - Save document with revision tracking
- `useCanvasDocumentDelete(adapter)` - Delete a document
- `useCanvasCommands(adapter)` - Apply commands to a document

#### Asset Management
- `useCanvasAssetUpload(adapter)` - Upload assets for document storage

#### Advanced Usage
- `useCanvasDocumentEditor(adapter, documentId, options)` - Combined hook for editing workflows with auto-save support

### Query Key Factory

Provided `canvasQueryKeys` for cache management:

```typescript
export const canvasQueryKeys = {
  all: ["canvas"],
  documents: (adapter) => [...canvasQueryKeys.all, adapter.name, "documents"],
  document: (adapter, documentId) => [...canvasQueryKeys.documents(adapter), documentId],
  documentList: (adapter) => [...canvasQueryKeys.documents(adapter), "list"]
};
```

## Package Configuration

### Updated `package.json`

```json
{
  "exports": {
    "./react-query": {
      "types": "./dist/react-query.d.ts",
      "import": "./dist/react-query.js",
      "require": "./dist/react-query.cjs"
    }
  },
  "peerDependencies": {
    "@tanstack/react-query": ">=5.0.0"
  },
  "peerDependenciesMeta": {
    "@tanstack/react-query": {
      "optional": true
    }
  }
}
```

### Build Configuration

Updated build script to include `react-query.ts`:
```bash
tsup src/index.ts src/react.ts src/indexed-db.ts src/react-query.ts --format esm,cjs \
  --external @tanstack/react-query
```

## Usage Examples

### Basic Document Loading

```tsx
import { useCanvasDocument } from "@denovo/canvas/react-query";
import { createIndexedDbDocumentAdapter } from "@denovo/canvas/indexed-db";

function CanvasEditor({ documentId }: { documentId: string }) {
  const adapter = createIndexedDbDocumentAdapter();
  const { data: document, isLoading, error } = useCanvasDocument(adapter, documentId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!document) return <div>Document not found</div>;

  return <DenovoCanvas document={document} />;
}
```

### Document List

```tsx
import { useCanvasDocumentList } from "@denovo/canvas/react-query";

function DocumentGallery() {
  const adapter = createIndexedDbDocumentAdapter();
  const { data: documents, isLoading } = useCanvasDocumentList(adapter);

  return (
    <div>
      {isLoading ? (
        <div>Loading documents...</div>
      ) : (
        <ul>
          {documents?.map(doc => (
            <li key={doc.id}>
              <a href={`/canvas/${doc.id}`}>
                {doc.title || `Document ${doc.id.slice(0, 8)}`}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Auto-saving Editor

```tsx
import { useCanvasDocumentEditor } from "@denovo/canvas/react-query";

function AutoSavingCanvas({ documentId }: { documentId: string }) {
  const adapter = createIndexedDbDocumentAdapter();
  const { document, save, isSaving } = useCanvasDocumentEditor(adapter, documentId, {
    autoSave: true,
    autoSaveDelay: 2000
  });

  const handleDocumentChange = (updatedDocument: CanvasDocument) => {
    save(updatedDocument);
  };

  return (
    <div>
      {isSaving && <div className="saving-indicator">Saving...</div>}
      <DenovoCanvas 
        document={document} 
        onChange={handleDocumentChange}
      />
    </div>
  );
}
```

### With Suspense Boundaries

```tsx
import { useCanvasDocumentSuspense } from "@denovo/canvas/react-query";

function DocumentViewer({ documentId }: { documentId: string }) {
  const adapter = createIndexedDbDocumentAdapter();
  const { data: document } = useCanvasDocumentSuspense(adapter, documentId);

  return <DenovoCanvas document={document} />;
}

function App() {
  return (
    <Suspense fallback={<DocumentLoader />}>
      <DocumentViewer documentId="doc-123" />
    </Suspense>
  );
}
```

## Type Safety

All hooks are fully typed with TypeScript:

- Generic type parameters for customization
- Proper error handling with Error types
- Support for all CanvasStorageAdapter capabilities
- Type-safe mutation options with UseMutationOptions

## Integration Points

### With Existing Storage Adapters

The hooks work seamlessly with all existing storage adapters:

```typescript
// IndexedDB (browser)
import { createIndexedDbDocumentAdapter } from "@denovo/canvas/indexed-db";

// Filesystem (server)
import { createFilesystemAdapter } from "@denovo/canvas-server";

// Memory adapter
import { createMemoryAdapter } from "@denovo/canvas-core";
```

### With React Query Client

Hooks integrate naturally with React Query QueryClient:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3
    },
    mutations: {
      retry: 1
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CanvasApp />
    </QueryClientProvider>
  );
}
```

## Testing

TypeScript compilation successful:
```bash
✓ pnpm typecheck
✓ pnpm build
```

All hooks properly export with correct types and external dependencies.

## Benefits for Advanced Users

TanStack Query hooks provide:

1. **Automatic caching** - Documents are cached and reused across components
2. **Background refetching** - Stay up-to-date with server changes
3. **Optimistic updates** - Instant UI feedback with mutation hooks
4. **Retry logic** - Built-in retry for failed operations
5. **Suspense support** - React Suspense boundaries for loading states
6. **DevTools integration** - Debug queries with React Query DevTools
7. **Type safety** - Full TypeScript support for all operations

## Future Enhancements

Potential additions for future versions:

- `useCanvasDocumentSubscription` - Real-time document updates
- `useCanvasCollaboration` - Multi-user editing support
- `useCanvasAssetList` - Asset gallery management
- `useCanvasHistory` - Document history/time-travel hooks

## Compatibility

- **Peer dependency**: `@tanstack/react-query@>=5.0.0` (optional)
- **React version**: Works with React 18+ and React 19
- **Platform**: Browser (IndexedDB) and server (filesystem)
- **TypeScript**: Full type definitions included

---

**Milestone M6 Status**: 🎉 Complete
All planned storage persistence features are now implemented and available through both direct API calls and TanStack Query hooks for advanced React integration.
