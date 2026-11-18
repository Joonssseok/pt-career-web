import type { LayoutBox } from "./FreeLayout";

export const layoutStorageKey = "pt-career:wireframe-layout:v1";
export type SavedLayout = {
  schema: 1;
  versionId: "balanced" | "rail" | "editorial" | "mosaic";
  mobile: boolean;
  centerline: boolean;
  boxes: LayoutBox[];
};

export function parseSavedLayout(raw: string | null): SavedLayout | null {
  if (!raw || raw.length > 100000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.schema !== 1 || !["balanced", "rail", "editorial", "mosaic"].includes(value.versionId) || typeof value.mobile !== "boolean" || typeof value.centerline !== "boolean" || !Array.isArray(value.boxes) || value.boxes.length > 200) return null;
    const ids = new Set<string>();
    for (const box of value.boxes) {
      if (!box || typeof box.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(box.id) || ids.has(box.id) || typeof box.label !== "string" || !box.label.trim() || box.label.length > 80) return null;
      ids.add(box.id);
      if (![box.x, box.y, box.w, box.h].every((n) => typeof n === "number" && Number.isFinite(n)) || box.x < 0 || box.y < 0 || box.w <= 0 || box.x + box.w > 100.01 || box.h <= 0 || box.y > 100000 || box.h > 10000) return null;
    }
    return value as SavedLayout;
  } catch { return null; }
}
