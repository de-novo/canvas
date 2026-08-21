import {
  defineUploadedAsset,
  readAssetUploadData,
  type AssetRecord,
  type AssetRef,
  type AssetUpload,
  type NodeId
} from "@denovo/canvas-core";

export type StoredAssetBlob = {
  asset: AssetRef;
  data: ArrayBuffer;
};

export async function storeUploadedAsset(
  upload: AssetUpload,
  defaultUri: (id: string) => string,
  put: (record: StoredAssetBlob) => void | Promise<void>
): Promise<AssetRef> {
  const data = await readAssetUploadData(upload.data);
  const draftId =
    typeof upload.asset.id === "string" && upload.asset.id.length > 0
      ? upload.asset.id
      : `asset-${Date.now().toString(36)}`;
  const asset = defineUploadedAsset(upload, data, defaultUri(draftId));
  await put({ asset, data });
  return asset;
}

export function storedAssetRecord(
  stored: StoredAssetBlob | undefined
): AssetRecord | null {
  return stored === undefined ? null : { asset: stored.asset, data: stored.data };
}

export function assertSafeAssetId(id: NodeId): NodeId {
  if (id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error(`Invalid asset id: ${id}`);
  }

  return id;
}
