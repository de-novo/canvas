import { z } from "zod";
import {
  definePluginNodeKind,
  registerPluginNodeKind,
  type PluginNodeType
} from "../plugin-nodes.js";

export const DENOVO_IMAGE_NODE_TYPE =
  "plugin.denovo.image" satisfies PluginNodeType;

export const DenovoImageFitSchema = z.enum(["contain", "cover", "fill"]);
export type DenovoImageFit = z.output<typeof DenovoImageFitSchema>;

const DenovoImageNonNegativeSchema = z.number().finite().nonnegative();
const DenovoImageCornerRadiusSchema = z.union([
  DenovoImageNonNegativeSchema,
  z.tuple([
    DenovoImageNonNegativeSchema,
    DenovoImageNonNegativeSchema,
    DenovoImageNonNegativeSchema,
    DenovoImageNonNegativeSchema
  ])
]);

export const DenovoImagePropsSchema = z
  .object({
    /** Optional `document.assets` entry id with `type: "image"`. */
    assetId: z.string().min(1).optional(),
    /** Optional direct image URI or data URL (`https://...`, `/path.png`, `data:image/...`). */
    src: z.string().min(1).optional(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    fit: DenovoImageFitSchema.optional(),
    cornerRadius: DenovoImageCornerRadiusSchema.optional(),
    opacity: z.number().finite().min(0).max(1).optional(),
    stroke: z.string().min(1).nullable().optional(),
    strokeWidth: DenovoImageNonNegativeSchema.optional(),
    placeholder: z.string().min(1).optional(),
    alt: z.string().optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.assetId === undefined && props.src === undefined) {
      context.addIssue({
        code: "custom",
        message: "plugin.denovo.image requires either assetId or src.",
        path: ["src"]
      });
    }
  });

export type DenovoImageProps = z.output<typeof DenovoImagePropsSchema>;

export type ResolvedDenovoImageStyle = {
  readonly fit: DenovoImageFit;
  readonly cornerRadius: number | readonly [number, number, number, number];
  readonly opacity: number;
  readonly stroke: string | null;
  readonly strokeWidth: number;
  readonly placeholder: string;
};

export type DenovoImageDrawRect = {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly dx: number;
  readonly dy: number;
  readonly dw: number;
  readonly dh: number;
};

export type CreateImageAssetRefOptions = {
  readonly uri?: string;
  readonly mimeType?: string;
  readonly byteLength?: number;
  readonly checksum?: string;
  readonly width?: number;
  readonly height?: number;
};

export const denovoImageKind = definePluginNodeKind({
  mode: "2d",
  props: DenovoImagePropsSchema,
  type: DENOVO_IMAGE_NODE_TYPE
});

registerPluginNodeKind(denovoImageKind);

export function isDenovoImageType(
  value: string
): value is typeof DENOVO_IMAGE_NODE_TYPE {
  return value === DENOVO_IMAGE_NODE_TYPE;
}

export function isDenovoImageNode<
  T extends { readonly props?: unknown; readonly type: string }
>(
  node: T
): node is T & {
  readonly props: DenovoImageProps;
  readonly type: typeof DENOVO_IMAGE_NODE_TYPE;
} {
  return (
    node.type === DENOVO_IMAGE_NODE_TYPE &&
    DenovoImagePropsSchema.safeParse(node.props).success
  );
}

export function parseDenovoImageProps(props: unknown): DenovoImageProps {
  return DenovoImagePropsSchema.parse(props);
}

export function denovoImageSize(
  props: DenovoImageProps
): readonly [number, number] {
  return [props.width, props.height];
}

export function resolveDenovoImageStyle(
  props: DenovoImageProps
): ResolvedDenovoImageStyle {
  return {
    fit: props.fit ?? "contain",
    cornerRadius: props.cornerRadius ?? 0,
    opacity: props.opacity ?? 1,
    stroke: props.stroke ?? null,
    strokeWidth: props.strokeWidth ?? 1,
    placeholder: props.placeholder ?? "#1e293b"
  };
}

/**
 * Pure aspect-preserving source/destination draw rectangle math shared by
 * Canvas2D and 2D WebGPU so `contain`, `cover`, and `fill` frame identically.
 */
export function resolveDenovoImageDrawRect(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: DenovoImageFit
): DenovoImageDrawRect | null {
  if (
    !Number.isFinite(naturalWidth) ||
    !Number.isFinite(naturalHeight) ||
    !Number.isFinite(boxWidth) ||
    !Number.isFinite(boxHeight) ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return null;
  }

  if (fit === "fill") {
    return {
      sx: 0,
      sy: 0,
      sw: naturalWidth,
      sh: naturalHeight,
      dx: 0,
      dy: 0,
      dw: boxWidth,
      dh: boxHeight
    };
  }

  if (fit === "contain") {
    const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
    const dw = naturalWidth * scale;
    const dh = naturalHeight * scale;
    return {
      sx: 0,
      sy: 0,
      sw: naturalWidth,
      sh: naturalHeight,
      dx: (boxWidth - dw) * 0.5,
      dy: (boxHeight - dh) * 0.5,
      dw,
      dh
    };
  }

  // fit === "cover"
  const scale = Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const sw = boxWidth / scale;
  const sh = boxHeight / scale;
  return {
    sx: (naturalWidth - sw) * 0.5,
    sy: (naturalHeight - sh) * 0.5,
    sw,
    sh,
    dx: 0,
    dy: 0,
    dw: boxWidth,
    dh: boxHeight
  };
}

/**
 * Builds a canonical `AssetRef` entry with `type: "image"` for referencing
 * from `plugin.denovo.image` (`props.assetId`).
 */
export function createImageAssetRef(
  id: string,
  options: CreateImageAssetRefOptions = {}
): {
  id: string;
  type: "image";
  uri?: string;
  mimeType?: string;
  byteLength?: number;
  checksum?: string;
  metadata: Record<string, number | string>;
} {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Image asset ref id must be a non-empty string.");
  }
  const metadata: Record<string, number | string> = {
    kind: "image"
  };
  if (options.width !== undefined) {
    if (!Number.isFinite(options.width) || options.width <= 0) {
      throw new TypeError("Image asset width must be a finite positive number.");
    }
    metadata.width = options.width;
  }
  if (options.height !== undefined) {
    if (!Number.isFinite(options.height) || options.height <= 0) {
      throw new TypeError("Image asset height must be a finite positive number.");
    }
    metadata.height = options.height;
  }
  return {
    id,
    type: "image",
    ...(options.uri === undefined ? {} : { uri: options.uri }),
    ...(options.mimeType === undefined ? {} : { mimeType: options.mimeType }),
    ...(options.byteLength === undefined ? {} : { byteLength: options.byteLength }),
    ...(options.checksum === undefined ? {} : { checksum: options.checksum }),
    metadata
  };
}
