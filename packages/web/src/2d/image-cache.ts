import type { DenovoImageProps } from "@de-novo/canvas-core";

export type CanvasImageSource2D =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | OffscreenCanvas;

/**
 * Session-scoped store of pre-decoded 2D image sources keyed by `AssetRef.id`.
 * Keeps binary bitmaps/elements out of the JSON document while letting
 * `plugin.denovo.image` nodes paint synchronously on first frame.
 */
export type CanvasImageStore = {
  readonly size: number;
  clear: () => void;
  delete: (assetId: string) => boolean;
  get: (assetId: string) => CanvasImageSource2D | undefined;
  has: (assetId: string) => boolean;
  set: (assetId: string, source: CanvasImageSource2D) => void;
};

export function createMemoryImageStore(
  initial: readonly (readonly [string, CanvasImageSource2D])[] = []
): CanvasImageStore {
  const map = new Map<string, CanvasImageSource2D>(initial);

  return {
    get size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    delete(assetId) {
      return map.delete(assetId);
    },
    get(assetId) {
      return map.get(assetId);
    },
    has(assetId) {
      return map.has(assetId);
    },
    set(assetId, source) {
      if (typeof assetId !== "string" || assetId.length === 0) {
        throw new TypeError("Image asset id must be a non-empty string.");
      }
      map.set(assetId, source);
    }
  };
}

export type ResolvedCanvasImage2D = {
  readonly source: CanvasImageSource2D;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
};

export function getCanvasImageSourceDimensions(
  source: CanvasImageSource2D
): readonly [number, number] | null {
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    if (!source.complete || source.naturalWidth <= 0 || source.naturalHeight <= 0) {
      return null;
    }
    return [source.naturalWidth, source.naturalHeight];
  }
  const width = source.width;
  const height = source.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return [width, height];
}

type CachedUriEntry = {
  readonly image: HTMLImageElement;
  status: "loading" | "loaded" | "error";
};

/**
 * Runtime image cache for `plugin.denovo.image` nodes. Resolves from an
 * optional synchronous `CanvasImageStore`, then from `assetId -> uri` or
 * `props.src` using deduplicated browser `Image` decoding and notifies the
 * runtime when an async decode finishes so Canvas2D and 2D WebGPU repaint.
 */
export class Canvas2DImageCache {
  private readonly imageStore: CanvasImageStore | undefined;
  private assetUris: ReadonlyMap<string, string>;
  private readonly uriEntries = new Map<string, CachedUriEntry>();
  private readonly onUpdate: () => void;
  private version = 0;
  private destroyed = false;

  constructor(options: {
    readonly assetUris?: ReadonlyMap<string, string>;
    readonly imageStore?: CanvasImageStore;
    readonly onUpdate: () => void;
  }) {
    this.imageStore = options.imageStore;
    this.assetUris = options.assetUris ?? new Map();
    this.onUpdate = options.onUpdate;
  }

  getVersion(): number {
    return this.version;
  }

  setAssetUris(uris: ReadonlyMap<string, string>): void {
    this.assetUris = uris;
    this.version += 1;
  }

  bumpVersion(): void {
    this.version += 1;
  }

  resolve(props: DenovoImageProps): ResolvedCanvasImage2D | null {
    if (props.assetId !== undefined) {
      const stored = this.imageStore?.get(props.assetId);
      if (stored) {
        const dims = getCanvasImageSourceDimensions(stored);
        if (dims) {
          return {
            source: stored,
            naturalWidth: dims[0],
            naturalHeight: dims[1]
          };
        }
      }
    }

    const uri =
      (props.assetId !== undefined ? this.assetUris.get(props.assetId) : undefined) ??
      props.src;
    if (!uri) {
      return null;
    }

    const existing = this.uriEntries.get(uri);
    if (existing) {
      if (existing.status === "loaded") {
        const dims = getCanvasImageSourceDimensions(existing.image);
        if (dims) {
          return {
            source: existing.image,
            naturalWidth: dims[0],
            naturalHeight: dims[1]
          };
        }
      }
      return null;
    }

    if (typeof Image === "undefined" || this.destroyed) {
      return null;
    }

    const image = new Image();
    image.decoding = "async";
    if (!uri.startsWith("data:") && !uri.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    const entry: CachedUriEntry = { image, status: "loading" };
    this.uriEntries.set(uri, entry);

    image.onload = () => {
      if (this.destroyed) {
        return;
      }
      entry.status = "loaded";
      this.version += 1;
      this.onUpdate();
    };
    image.onerror = () => {
      if (this.destroyed) {
        return;
      }
      entry.status = "error";
    };
    image.src = uri;

    // Data URLs or cached browser images can complete synchronously.
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      entry.status = "loaded";
      return {
        source: image,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight
      };
    }

    return null;
  }

  destroy(): void {
    this.destroyed = true;
    for (const entry of this.uriEntries.values()) {
      entry.image.onload = null;
      entry.image.onerror = null;
    }
    this.uriEntries.clear();
  }
}
