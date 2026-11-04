import { createClient } from "@/lib/supabase/client";
import {
  validateDetailImages,
  type EditableDetailImage,
} from "./detail-images";

export async function uploadDetailImage(
  owner: string,
  group: string,
  image: EditableDetailImage,
) {
  if (!image.file) return image.id;
  const invalid = validateDetailImages([image.file], 0);
  if (invalid) throw new Error(invalid);
  const client = createClient();
  const { data: reservation, error } = await client.rpc(
    "reserve_profile_detail_image",
    {
      p_id: image.id,
      p_group: group,
      p_name: image.name,
      p_mime: image.file.type,
    },
  );
  if (error)
    throw new Error(
      "이미지 저장 공간을 확보하지 못했습니다. 저장 용량과 서버 연결을 확인해주세요.",
    );
  try {
    if (!reservation?.path?.startsWith(owner + "/"))
      throw new Error("invalid-owner");
    if (!reservation.ready) {
      const result = await client.storage
        .from("profile-detail-images")
        .upload(reservation.path, image.file, {
          contentType: image.file.type,
          upsert: false,
          cacheControl: "0",
        });
      if (result.error && !(String(result.error.statusCode) === "409"))
        throw new Error("upload-failed");
    }
    const finished = await client.rpc("finish_profile_detail_image", {
      p_id: image.id,
    });
    if (finished.error) throw new Error("verify-failed");
  } catch {
    throw new Error(
      "이미지를 업로드하지 못했습니다. 선택한 이미지는 유지됩니다. 다시 저장해주세요.",
    );
  }
  return image.id;
}
