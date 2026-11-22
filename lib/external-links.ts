import { normalizePostLink } from "./profile-post-document";
export const EXTERNAL_LINK_KINDS = [
  "youtube",
  "instagram",
  "blog",
  "threads",
  "kakao",
  "custom",
];
export type SavedExternalLink = {
  id: string;
  kind: string;
  label: string;
  url: string;
  is_primary: boolean;
};
export function externalLinksValid(
  value: unknown,
): value is Omit<SavedExternalLink, "id">[] {
  return (
    Array.isArray(value) &&
    value.length <= 15 &&
    value.filter((link) => link?.is_primary === true).length <= 1 &&
    value.every(
      (link) =>
        link &&
        typeof link === "object" &&
        Object.keys(link).every((k) =>
          ["kind", "label", "url", "is_primary"].includes(k),
        ) &&
        EXTERNAL_LINK_KINDS.includes(link.kind) &&
        typeof link.label === "string" &&
        link.label.trim().length > 0 &&
        [...link.label].length <= 40 &&
        !/[\u0000-\u001f\u007f<>]/.test(link.label) &&
        typeof link.url === "string" &&
        !!normalizePostLink(link.url) &&
        typeof link.is_primary === "boolean",
    )
  );
}
