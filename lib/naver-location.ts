export type NaverLocation = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export function validLocation(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function naverLocalResults(data: unknown): NaverLocation[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("items" in data) ||
    !Array.isArray(data.items)
  )
    return [];
  return data.items.slice(0, 5).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const rawAddress =
      typeof row.roadAddress === "string" && row.roadAddress.trim()
        ? row.roadAddress
        : row.address;
    if (
      typeof rawAddress !== "string" ||
      !rawAddress.trim() ||
      typeof row.title !== "string"
    )
      return [];
    if (
      !/^-?\d+(?:\.\d+)?$/.test(String(row.mapy)) ||
      !/^-?\d+(?:\.\d+)?$/.test(String(row.mapx))
    )
      return [];
    // Accept WGS84 degrees and NAVER's WGS84 × 10^7 representation.
    const y = Number(row.mapy),
      x = Number(row.mapx);
    const scale = Math.abs(y) > 90 || Math.abs(x) > 180 ? 1e7 : 1;
    const latitude = y / scale,
      longitude = x / scale;
    if (!validLocation(latitude, longitude)) return [];
    const name = row.title
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim()
      .slice(0, 160);
    return [
      { name, address: rawAddress.trim().slice(0, 300), latitude, longitude },
    ];
  });
}
