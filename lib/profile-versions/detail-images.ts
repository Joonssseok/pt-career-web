export const DETAIL_IMAGE_LIMIT = 20 * 1024 * 1024;
export const DETAIL_IMAGE_COUNT = 20;
export type DetailImage = {
  id: string;
  name: string;
  size: number;
  src: string;
};
export type EditableDetailImage = DetailImage & { file?: File };
export type DetailImagesState = {
  images: DetailImage[];
  revision: string | null;
  ok: boolean;
};
export function validateDetailImages(files: File[], count: number) {
  if (files.length + count > DETAIL_IMAGE_COUNT)
    return "이미지는 최대 20장까지 첨부할 수 있습니다.";
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return "JPG, PNG, WebP 이미지를 선택해주세요.";
    if (!file.size || file.size > DETAIL_IMAGE_LIMIT)
      return "이미지는 한 장당 20MB 이하로 선택해주세요.";
  }
  return "";
}
export const detailImageSrc = (id: string) =>
  `/api/profile-detail-images/${encodeURIComponent(id)}`;
