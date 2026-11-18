import { imageCropValid, type ImageCrop } from "./image-presentation";
export type CropperRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function cropperRectToCrop(
  rect: CropperRect,
  image: CropperRect,
): ImageCrop | null {
  if (
    ![...Object.values(rect), ...Object.values(image)].every(Number.isFinite) ||
    image.width <= 0 ||
    image.height <= 0
  )
    return null;
  const value = {
    x: ((rect.x - image.x) / image.width) * 100,
    y: ((rect.y - image.y) / image.height) * 100,
    width: (rect.width / image.width) * 100,
    height: (rect.height / image.height) * 100,
  };
  // Reject outside/empty selections instead of persisting a different visible area.
  const epsilon = 0.000001;
  if (
    value.x < -epsilon ||
    value.y < -epsilon ||
    value.width < 1 ||
    value.height < 1 ||
    value.x + value.width > 100 + epsilon ||
    value.y + value.height > 100 + epsilon
  )
    return null;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const width = Math.min(100, round(value.width)),
    height = Math.min(100, round(value.height));
  const crop = {
    x: Math.max(0, Math.min(100 - width, round(value.x))),
    y: Math.max(0, Math.min(100 - height, round(value.y))),
    width,
    height,
  };
  return imageCropValid(crop) ? crop : null;
}
export function cropToCropperRect(
  crop: ImageCrop,
  image: CropperRect,
): CropperRect {
  return {
    x: image.x + (crop.x / 100) * image.width,
    y: image.y + (crop.y / 100) * image.height,
    width: (crop.width / 100) * image.width,
    height: (crop.height / 100) * image.height,
  };
}
