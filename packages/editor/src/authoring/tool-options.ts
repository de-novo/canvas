import {
  type CanvasCoordinateForMode,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasGridForMode,
  type CanvasLayerId,
  type CanvasMode,
  type CanvasNodeByType,
  type CanvasWorkPlane,
  type NodeId,
  type Point2,
  type Vector3
} from "@denovo/canvas-core";

type CanvasAuthoringToolOptionsBase<
  TMode extends CanvasMode,
  TId extends string = string
> = {
  readonly createId: CanvasCreateId;
  readonly cursor?: string;
  readonly grid?: CanvasGridForMode<TMode>;
  readonly id?: TId;
  readonly label?: string;
  readonly layerId: CanvasLayerId;
  readonly mode: TMode;
};

type Canvas2DAuthoringToolOptionsBase<TId extends string = string> =
  CanvasAuthoringToolOptionsBase<"2d", TId>;

type Canvas3DAuthoringToolOptionsBase<TId extends string = string> =
  CanvasAuthoringToolOptionsBase<"3d", TId> & {
    readonly workPlane: CanvasWorkPlane;
  };

export type Canvas2DShapeToolOptions<TId extends string = string> =
  | (Canvas2DAuthoringToolOptionsBase<TId> & {
      readonly fill?: CanvasNodeByType<"2d", "rect">["fill"];
      readonly type: "rect";
    })
  | (Canvas2DAuthoringToolOptionsBase<TId> & {
      readonly fill?: CanvasNodeByType<"2d", "circle">["fill"];
      readonly type: "circle";
    });

export type Canvas3DPrimitiveToolOptions<TId extends string = string> =
  | (Canvas3DAuthoringToolOptionsBase<TId> & {
      readonly color?: CanvasNodeByType<"3d", "box">["color"];
      readonly rotation?: CanvasNodeByType<"3d", "box">["rotation"];
      readonly scale?: CanvasNodeByType<"3d", "box">["scale"];
      readonly type: "box";
    })
  | (Canvas3DAuthoringToolOptionsBase<TId> & {
      readonly color?: CanvasNodeByType<"3d", "sphere">["color"];
      readonly radius?: CanvasNodeByType<"3d", "sphere">["radius"];
      readonly rotation?: CanvasNodeByType<"3d", "sphere">["rotation"];
      readonly scale?: CanvasNodeByType<"3d", "sphere">["scale"];
      readonly type: "sphere";
    });

export type Canvas3DSurfacePlacementToolOptions<
  TId extends string = string
> = {
  readonly color?: CanvasNodeByType<"3d", "box">["color"];
  readonly createId: CanvasCreateId;
  readonly cursor?: string;
  readonly id?: TId;
  readonly label?: string;
  readonly layerId: CanvasLayerId;
  readonly mode: "3d";
  readonly placement: {
    readonly kind: "box-face";
    readonly orientation: "world-aligned";
  };
  readonly scale?: CanvasNodeByType<"3d", "box">["scale"];
  readonly type: "box";
};

export type CanvasDistanceMeasurementToolOptions<TId extends string = string> =
  | (Canvas2DAuthoringToolOptionsBase<TId> & {
      readonly precision: CanvasNodeByType<"2d", "measurement">["precision"];
      readonly type: "measurement";
      readonly unit: CanvasNodeByType<"2d", "measurement">["unit"];
    })
  | (Canvas3DAuthoringToolOptionsBase<TId> & {
      readonly precision: CanvasNodeByType<"3d", "measurement">["precision"];
      readonly type: "measurement";
      readonly unit: CanvasNodeByType<"3d", "measurement">["unit"];
    });

export type CanvasAnnotationDraft<TMode extends CanvasMode> = Pick<
  CanvasNodeByType<TMode, "annotation">,
  "targetId" | "text"
>;

export type CanvasAnnotationDraftResult<TMode extends CanvasMode> =
  | {
      readonly draft: CanvasAnnotationDraft<TMode>;
      readonly kind: "commit";
    }
  | {
      readonly kind: "cancel";
    };

export type CanvasAnnotationDraftContext<TMode extends CanvasMode> = {
  readonly anchor: CanvasCoordinateForMode<TMode>;
  readonly document: CanvasDocument;
  readonly mode: TMode;
};

export type CanvasAnnotationDraftProvider<TMode extends CanvasMode> = (
  context: CanvasAnnotationDraftContext<TMode>
) =>
  | CanvasAnnotationDraftResult<TMode>
  | Promise<CanvasAnnotationDraftResult<TMode>>;

export type CanvasAnnotationToolOptions<TId extends string = string> =
  | (Canvas2DAuthoringToolOptionsBase<TId> & {
      readonly provideDraft: CanvasAnnotationDraftProvider<"2d">;
      readonly type: "annotation";
    })
  | (Canvas3DAuthoringToolOptionsBase<TId> & {
      readonly provideDraft: CanvasAnnotationDraftProvider<"3d">;
      readonly type: "annotation";
    });

export type CanvasConnectorToolOptions<TId extends string = string> =
  Canvas2DAuthoringToolOptionsBase<TId> & {
    readonly stroke?: string;
    readonly strokeWidth?: number;
    readonly lineStyle?: "solid" | "dashed" | "dotted";
    readonly targetArrow?: boolean;
    readonly curve?: "straight" | "curved";
    readonly curveOffset?: number;
  };
