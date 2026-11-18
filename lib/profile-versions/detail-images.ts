export const DETAIL_IMAGE_LIMIT = 20 * 1024 * 1024;
export const DETAIL_IMAGE_COUNT = 20;
export const DETAIL_IMAGE_TOTAL_LIMIT = 200 * 1024 * 1024;
export const DETAIL_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];
export type DetailImage = {
  id: string;
  name: string;
  size: number;
  src: string;
  mime?: string;
};
export type EditableDetailImage = DetailImage & { file?: File };
export type DetailImagesState = {
  images: DetailImage[];
  revision: string | null;
  ok: boolean;
};
export function validateDetailImages(
  files: File[],
  count: number,
  existingBytes = 0,
) {
  if (files.length + count > DETAIL_IMAGE_COUNT)
    return "이미지·동영상은 최대 20장(개)까지 첨부할 수 있습니다.";
  for (const file of files) {
    if (!DETAIL_IMAGE_MIME_TYPES.includes(file.type))
      return "JPG, PNG, WebP, GIF 이미지 또는 MP4, WebM 동영상을 선택해주세요.";
    if (!file.size || file.size > DETAIL_IMAGE_LIMIT)
      return "첨부파일은 한 개당 20MB 이하로 선택해주세요.";
  }
  if (
    existingBytes + files.reduce((total, file) => total + file.size, 0) >
    DETAIL_IMAGE_TOTAL_LIMIT
  )
    return "첨부파일은 합계 200MB 이하로 선택해주세요.";
  return "";
}
export const detailImageSrc = (id: string) =>
  `/api/profile-detail-images/${encodeURIComponent(id)}`;
