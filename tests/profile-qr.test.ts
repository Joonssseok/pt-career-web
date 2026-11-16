import sharp from "sharp";
import jsQR from "jsqr";
import { profileQrImage, profileShareUrl } from "@/lib/profile-sharing/qr";

test("QR PNG remains readable at screen and business-card sizes and contains only the permanent public URL", async () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  const expected = `https://ptcareer.co.kr/experts/${id}`;
  const image = await profileQrImage(profileShareUrl(id));
  const png = Buffer.from(image.split(",")[1], "base64");
  for (const size of [1024, 256, 240]) {
    const { data, info } = await sharp(png)
      .resize(size, size, { kernel: "nearest" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data,
    ).toBe(expected);
  }
});

test("profile URL is pinned to the production domain and escapes path data", () => {
  const url = new URL(profileShareUrl("profile?token=should-not-be-a-query"));
  expect(url.origin).toBe("https://ptcareer.co.kr");
  expect(url.search).toBe("");
  expect(url.hash).toBe("");
});
