// Printed codes keep the production domain and the profile owner's stable ID.
export function profileShareUrl(profileId: string) {
  return `https://ptcareer.co.kr/experts/${encodeURIComponent(profileId)}`;
}

export async function profileQrImage(url: string) {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 1024,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}
