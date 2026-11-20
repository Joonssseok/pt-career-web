export const EVIDENCE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const EVIDENCE_FILE_LIMIT = 10 * 1024 * 1024;
export type MaskRect = { x: number; y: number; width: number; height: number };
export type MaskWord = MaskRect & {
  id: string;
  text: string;
  sensitive: boolean;
  required: boolean;
};
export const isEvidencePdf = (file: {
  name: string;
  type?: string;
  blob?: Blob;
}) =>
  file.type === "application/pdf" ||
  file.blob?.type === "application/pdf" ||
  /\.pdf$/i.test(file.name);
export function normalizedRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
): MaskRect {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const x = clamp(Math.min(a.x, b.x)),
    y = clamp(Math.min(a.y, b.y));
  return {
    x,
    y,
    width: clamp(Math.max(a.x, b.x)) - x,
    height: clamp(Math.max(a.y, b.y)) - y,
  };
}
export function containsWord(rects: MaskRect[], word: MaskRect) {
  return rects.some(
    (r) =>
      r.x <= word.x &&
      r.x + r.width >= word.x + word.width &&
      r.y <= word.y &&
      r.y + r.height >= word.y + word.height,
  );
}
export function overlapsWord(rects: MaskRect[], word: MaskRect) {
  return rects.some(
    (r) =>
      r.x < word.x + word.width &&
      r.x + r.width > word.x &&
      r.y < word.y + word.height &&
      r.y + r.height > word.y,
  );
}
export function sensitiveEvidenceText(text: string) {
  return /\d{6}\s*[-–]\s*\d{7}|(?:01[016789]|0\d{1,2})[-\s]?\d{3,4}[-\s]?\d{4}|[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,}|주소|(?:특별시|광역시|특별자치시|특별자치도)|[가-힣]+(?:로|길)\s*\d+/i.test(
    text,
  );
}
export function requiredEvidenceText(text: string, ownName: string) {
  return (
    (!!ownName &&
      text.replace(/\s/g, "").includes(ownName.replace(/\s/g, ""))) ||
    /성명|면허|자격|발급|보건복지|이수|수료|대학교|협회/.test(text.replace(/\s/g,''))
  );
}
export async function loadEvidenceCanvas(
  file: { blob?: Blob; href: string },
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  let blob = file.blob;
  if (!blob) {
    // Use only our authenticated file routes; never send a document to an OCR service.
    if (
      !/^\/api\/(?:damoa\/files\/|evidence-file\/|profile-evidence\/)/.test(
        file.href,
      ) &&
      !file.href.startsWith("/preview/")
    )
      throw new Error("자료의 출처를 확인하지 못했습니다.");
    const response = await fetch(file.href, { cache: "no-store", signal });
    if (!response.ok)
      throw new Error("자료를 불러오지 못했습니다. 다시 시도해주세요.");
    blob = await response.blob();
  }
  if (!EVIDENCE_IMAGE_TYPES.includes(blob.type))
    throw new Error(
      "PDF는 보낼 수 없어요. 사진(JPG·PNG·WebP)으로 올려 주세요.",
    );
  if (blob.size > EVIDENCE_FILE_LIMIT)
    throw new Error("사진 한 개는 10MB 이하여야 합니다.");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (signal?.aborted) throw new Error("취소됨");
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 32000000
    )
      throw new Error(
        "사진이 너무 큽니다. 3200만 화소 이하 사진을 선택해주세요.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이 브라우저에서 사진을 열지 못했습니다.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function paintMaskedCopy(
  source: HTMLCanvasElement,
  rects: MaskRect[],
): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) throw new Error("사본을 만들지 못했습니다.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, copy.width, copy.height);
  ctx.drawImage(source, 0, 0);
  ctx.fillStyle = "#000";
  for (const r of rects) {
    const x = Math.max(0, Math.floor(r.x * copy.width) - 2),
      y = Math.max(0, Math.floor(r.y * copy.height) - 2);
    ctx.fillRect(
      x,
      y,
      Math.ceil((r.x + r.width) * copy.width) + 2 - x,
      Math.ceil((r.y + r.height) * copy.height) + 2 - y,
    );
  }
  return copy;
}
export async function encodeMaskedCopy(
  source: HTMLCanvasElement,
  rects: MaskRect[],
): Promise<File> {
  const canvas = paintMaskedCopy(source, rects);
  for (const quality of [0.95, 0.85, 0.7]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= EVIDENCE_FILE_LIMIT)
      return new File([blob], "증빙자료-가린사본.jpg", { type: "image/jpeg" });
  }
  throw new Error("사본이 10MB를 넘습니다. 더 작은 사진을 선택해주세요.");
}
