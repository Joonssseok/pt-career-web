import { DETAIL_IMAGE_MIME_TYPES } from "./detail-images";

export type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function imageCropValid(value: unknown): value is ImageCrop {
  if (
    !record(value) ||
    Object.keys(value).some(
      (key) => !["x", "y", "width", "height"].includes(key),
    )
  )
    return false;
  const { x, y, width, height } = value;
  if (
    ![x, y, width, height].every(
      (part) => typeof part === "number" && Number.isFinite(part),
    )
  )
    return false;
  return (
    Number(x) >= 0 &&
    Number(x) <= 100 &&
    Number(y) >= 0 &&
    Number(y) <= 100 &&
    Number(width) >= 1 &&
    Number(width) <= 100 &&
    Number(height) >= 1 &&
    Number(height) <= 100 &&
    Number(x) + Number(width) <= 100.000001 &&
    Number(y) + Number(height) <= 100.000001
  );
}

// Accept full profileMedia attributes; file identity is checked by the document validator.
export function imagePresentationValid(attrs: unknown): boolean {
  if (
    !record(attrs) ||
    Object.keys(attrs).some(
      (key) => !["fileId", "mime", "widthPercent", "crop"].includes(key),
    )
  )
    return false;
  if (
    typeof attrs.mime !== "string" ||
    !DETAIL_IMAGE_MIME_TYPES.includes(attrs.mime)
  )
    return false;
  const hasWidth = Object.prototype.hasOwnProperty.call(attrs, "widthPercent");
  const hasCrop = Object.prototype.hasOwnProperty.call(attrs, "crop");
  if (attrs.mime.startsWith("video/") && (hasWidth || hasCrop)) return false;
  if (
    hasWidth &&
    (typeof attrs.widthPercent !== "number" ||
      !Number.isInteger(attrs.widthPercent) ||
      attrs.widthPercent < 10 ||
      attrs.widthPercent > 100)
  )
    return false;
  return !hasCrop || imageCropValid(attrs.crop);
}
