import { validLocation, type NaverLocation } from "@/lib/naver-location";

export type ContactKey = "inquiry" | "phone" | "email" | "address";
type ContactField = { value: string; visible: boolean };
export type ContactInquiry = Record<ContactKey, ContactField> & {
  inquiryLabel: string;
  location: NaverLocation | null;
  detailAddress: string;
  mapVisible: boolean;
};
export type PublicContactInquiry = {
  inquiry?: { label: string; url: string };
  phone?: string;
  email?: string;
  address?: { base: string; detail: string };
  map?: Pick<NaverLocation, "latitude" | "longitude">;
};
export function emptyContactInquiry(): ContactInquiry {
  return {
    inquiryLabel: "수업 문의하기",
    location: null,
    detailAddress: "",
    mapVisible: false,
    inquiry: { value: "", visible: false },
    phone: { value: "", visible: false },
    email: { value: "", visible: false },
    address: { value: "", visible: false },
  };
}

const controls = /[\u0000-\u001f\u007f]/;
export function contactHref(key: ContactKey, value: string): string | null {
  const text = value.trim();
  if (!text || controls.test(value)) return null;
  if (key === "inquiry") {
    if (/[\s\\<>"']/.test(text) || text.length > 500) return null;
    try {
      const url = new URL(text);
      return /^https?:\/\//i.test(text) &&
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
        ? url.href
        : null;
    } catch {
      return null;
    }
  }
  if (key === "phone")
    return /^\+?[\d ()-]{7,25}$/.test(text) &&
      /^\+?\d{7,15}$/.test(text.replace(/[ ()-]/g, ""))
      ? `tel:${text.replace(/[ ()-]/g, "")}`
      : null;
  if (key === "email")
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
      ? `mailto:${encodeURIComponent(text)}`
      : null;
  return text;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return (
    Object.keys(value).length === allowed.length &&
    allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}
function string(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    [...value].length <= max &&
    !controls.test(value)
  );
}
export function validateContactInquiry(
  value: unknown,
): { ok: true; contact: ContactInquiry } | { ok: false; error: string } {
  const invalid = {
    ok: false as const,
    error: "연락·문의 안내의 입력 내용과 주소 선택을 확인해주세요.",
  };
  if (
    !object(value) ||
    !keys(value, [
      "inquiryLabel",
      "inquiry",
      "phone",
      "email",
      "address",
      "location",
      "detailAddress",
      "mapVisible",
    ]) ||
    !string(value.inquiryLabel, 24) ||
    !string(value.detailAddress, 120) ||
    typeof value.mapVisible !== "boolean"
  )
    return invalid;
  const contact = emptyContactInquiry();
  contact.inquiryLabel = value.inquiryLabel.trim();
  contact.detailAddress = value.detailAddress.trim();
  contact.mapVisible = value.mapVisible;
  for (const key of ["inquiry", "phone", "email", "address"] as const) {
    const field = value[key];
    if (
      !object(field) ||
      !keys(field, ["value", "visible"]) ||
      !string(
        field.value,
        key === "inquiry" ? 500 : key === "address" ? 300 : 160,
      ) ||
      typeof field.visible !== "boolean"
    )
      return invalid;
    if (field.value.trim() && !contactHref(key, field.value)) return invalid;
    contact[key] = { value: field.value.trim(), visible: field.visible };
  }
  if (value.location === null) {
    if (contact.address.value || contact.detailAddress || contact.mapVisible)
      return invalid;
  } else {
    const location = value.location;
    if (
      !object(location) ||
      !keys(location, ["name", "address", "latitude", "longitude"]) ||
      !string(location.name, 160) ||
      !string(location.address, 300) ||
      !location.address.trim() ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number" ||
      !validLocation(location.latitude, location.longitude) ||
      contact.address.value !== location.address.trim()
    )
      return invalid;
    contact.location = {
      name: location.name.trim(),
      address: location.address.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }
  return { ok: true, contact };
}

// Project only selected fields; never pass the private saved object to public UI.
export function publicContactInquiry(value: unknown): PublicContactInquiry {
  const checked = validateContactInquiry(value);
  if (!checked.ok) return {};
  const contact = checked.contact;
  const result: PublicContactInquiry = {};
  if (contact.inquiry.visible && contact.inquiry.value)
    result.inquiry = {
      label: contact.inquiryLabel || "수업 문의하기",
      url: contact.inquiry.value,
    };
  if (contact.phone.visible && contact.phone.value)
    result.phone = contact.phone.value;
  if (contact.email.visible && contact.email.value)
    result.email = contact.email.value;
  if (contact.address.visible && contact.address.value)
    result.address = {
      base: contact.address.value,
      detail: contact.detailAddress,
    };
  if (contact.mapVisible && contact.location)
    result.map = {
      latitude: contact.location.latitude,
      longitude: contact.location.longitude,
    };
  return result;
}
