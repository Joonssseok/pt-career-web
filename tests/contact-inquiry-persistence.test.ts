import {
  emptyContactInquiry,
  validateContactInquiry,
  publicContactInquiry,
  type ContactInquiry,
} from "@/lib/profile-versions/contact-inquiry";
import { applyVersion, sameProfileContent } from "@/lib/profile-versions/types";
import {
  saveProfileVersion,
  publishProfileVersion,
} from "@/app/actions/profile-versions";
import { createClient } from "@/lib/supabase/server";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const auth = jest.fn(),
  rpc = jest.fn();
const content = {
  headline: "소개",
  introduction: "본문",
  sections: [],
  activities: [],
};
function contact(): ContactInquiry {
  return {
    ...emptyContactInquiry(),
    inquiry: { value: "https://example.com/book", visible: true },
    phone: { value: "02-0000-0000", visible: false },
    email: { value: "private@example.com", visible: false },
    address: { value: "비공개 근무지 주소", visible: false },
    detailAddress: "비공개 3층",
    location: {
      name: "기관명 비공개",
      address: "비공개 근무지 주소",
      latitude: 37.5,
      longitude: 127.1,
    },
    mapVisible: true,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(createClient)
    .mockResolvedValue({ auth: { getUser: auth }, rpc } as never);
  auth.mockResolvedValue({ data: { user: { id: "owner" } } });
  rpc.mockResolvedValue({ data: "version-id", error: null });
});
test.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "address=%s map=%s projects no unselected metadata",
  (addressVisible, mapVisible) => {
    const saved = contact();
    saved.address.visible = addressVisible;
    saved.mapVisible = mapVisible;
    const safe = publicContactInquiry(saved);
    expect(safe.address).toEqual(
      addressVisible
        ? {
            base: saved.address.value,
            detail: saved.detailAddress,
            name: saved.location!.name,
          }
        : undefined,
    );
    expect(safe.map).toEqual(
      mapVisible ? { latitude: 37.5, longitude: 127.1 } : undefined,
    );
    expect(safe.phone).toBeUndefined();
    expect(safe.email).toBeUndefined();
    expect(JSON.stringify(safe)).not.toContain(saved.email.value);
    expect(JSON.stringify(safe)).not.toContain(saved.phone.value);
    if (!addressVisible) {
      expect(JSON.stringify(safe)).not.toContain(saved.location!.name);
      expect(JSON.stringify(safe)).not.toContain(saved.address.value);
      expect(JSON.stringify(safe)).not.toContain(saved.detailAddress);
    }
  },
);
test("legacy content leaves existing safe projection alone, explicit empty settings clear it", () => {
  const base = {
    experiences: [],
    academic_records: [],
    educations: [],
    licenses: [],
    contact_inquiry: { email: "legacy@example.com" },
  } as unknown as Parameters<typeof applyVersion>[0];
  expect(applyVersion(base, content).contact_inquiry).toEqual(
    base.contact_inquiry,
  );
  expect(
    applyVersion(base, { ...content, contactInquiry: emptyContactInquiry() })
      .contact_inquiry,
  ).toEqual({});
  expect(base.contact_inquiry).toEqual({ email: "legacy@example.com" });
  expect(
    sameProfileContent(
      { ...content, contactInquiry: contact() },
      { ...content, contactInquiry: { ...contact(), mapVisible: false } },
    ),
  ).toBe(false);
});
test("closed validation rejects unsafe values and inconsistent location, including hidden fields", () => {
  const original = contact();
  const invalid: unknown[] = [
    null,
    [],
    { ...original, extra: true },
    { ...original, mapVisible: "true" },
    { ...original, inquiry: { value: "javascript:alert(1)", visible: false } },
    {
      ...original,
      inquiry: { value: "https://user:secret@example.com", visible: true },
    },
    {
      ...original,
      inquiry: { value: "https://example.com/\n", visible: false },
    },
    { ...original, email: { value: "invalid", visible: false } },
    { ...original, phone: { value: "not a number", visible: false } },
    { ...original, phone: { value: "-------", visible: false } },
    { ...original, phone: { value: "(1)----", visible: false } },
    { ...original, phone: { value: "1234567890123456", visible: false } },
    { ...original, location: { ...original.location, latitude: NaN } },
    { ...original, location: { ...original.location, longitude: 181 } },
    { ...original, location: { ...original.location, internalId: "private" } },
    { ...original, location: null },
    {
      ...original,
      address: { value: "선택한 주소와 다른 주소", visible: false },
    },
    { ...original, inquiryLabel: "a".repeat(25) },
    { ...original, detailAddress: "a".repeat(121) },
  ];
  expect(validateContactInquiry(original).ok).toBe(true);
  expect(validateContactInquiry(emptyContactInquiry()).ok).toBe(true);
  for (const value of invalid) {
    expect(validateContactInquiry(value).ok).toBe(false);
    expect(publicContactInquiry(value)).toEqual({});
  }
});
test("owner save retains private fields and both visibility flags without publishing", async () => {
  const saved = contact();
  expect(
    (
      await saveProfileVersion("version-id", "프로필", {
        ...content,
        contactInquiry: saved,
      })
    ).ok,
  ).toBe(true);
  expect(rpc).toHaveBeenCalledWith("save_profile_version", {
    p_id: "version-id",
    p_title: "프로필",
    p_content: { ...content, contactInquiry: saved },
  });
  expect(rpc).not.toHaveBeenCalledWith(
    "publish_profile_with_reviews",
    expect.anything(),
  );
});
test("save/publish validate before RPC and require owner authentication", async () => {
  const invalid = {
    ...content,
    contactInquiry: { ...contact(), mapVisible: "true" },
  } as never;
  expect((await saveProfileVersion("v", "프로필", invalid)).ok).toBe(false);
  expect((await publishProfileVersion("v", invalid, [])).ok).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
  auth.mockResolvedValue({ data: { user: null } });
  expect(
    (
      await saveProfileVersion("v", "프로필", {
        ...content,
        contactInquiry: contact(),
      })
    ).ok,
  ).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
