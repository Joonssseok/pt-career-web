import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { publicShareProfile } from "@/lib/profile-sharing/public-share-profile";
import { shareImageText } from "@/lib/profile-sharing/share-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const source = await publicShareProfile((await params).id);
    if (!source) return new Response(null, { status: 404, headers });
    const { profile, client } = source;
    const { name, role } = shareImageText(profile);
    let photo: string | null = null;
    if (profile.profile_image_path) {
      const { data, error } = await client.storage.from("profile-images").download(profile.profile_image_path);
      if (!error && data && data.size <= 10 * 1024 * 1024) {
        try {
          const png = await sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 25000000 })
            .rotate().resize(428, 550, { fit: "contain", background: "#f5f7fa" }).png().toBuffer();
          photo = `data:image/png;base64,${png.toString("base64")}`;
        } catch { /* An unreadable photo still leaves a useful name card. */ }
      }
    }
    const [regular, bold] = await Promise.all([
      readFile(join(process.cwd(), "assets/fonts/Pretendard-Regular.otf")),
      readFile(join(process.cwd(), "assets/fonts/Pretendard-Bold.otf")),
    ]);
    const image = new ImageResponse(
      <div style={{ width: 1200, height: 630, display: "flex", alignItems: "center", padding: "40px 82px", gap: 90, background: "#f5f7fa", fontFamily: "Pretendard" }}>
        {photo ? <img src={photo} width={428} height={550} alt="" style={{ borderRadius: 16 }} /> :
          <div style={{ width: 428, height: 550, display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", fontSize: 100, fontWeight: 700 }}>PT</div>}
        <div style={{ width: 518, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: name.length > 10 ? 48 : name.length > 6 ? 62 : 82, fontWeight: 700, lineHeight: 1.2, letterSpacing: -2, color: "#14233b", wordBreak: "break-all" }}>{name}</div>
          {role && <div style={{ fontSize: role.length > 18 ? 30 : 43, fontWeight: 400, lineHeight: 1.5, color: "#65748a", marginTop: 20, letterSpacing: -1 }}>{role}</div>}
        </div>
      </div>,
      { width: 1200, height: 630, headers, fonts: [
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ] },
    );
    // Finish rendering here so failures return a controlled response, not a broken image stream.
    return new Response(await image.arrayBuffer(), { headers: { ...headers, "Content-Type": "image/png" } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
