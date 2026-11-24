/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  SPECIALTY_CATALOG,
  SPECIALTY_PREVIEW_OPTIONS,
  HOSPITAL_WORK_NOTICE,
  HOSPITAL_WORK_SELECTION_NOTE,
  HOSPITAL_WORK_TOOLTIP,
  canonicalSpecialtySlug,
  canonicalSpecialtySlugs,
  hasHospitalWork,
} from "@/lib/specialties/catalog";
import { SpecialtyDirectory } from "@/components/specialties/SpecialtyDirectory";
import { ExpertCard, type ExpertListItem } from "@/app/experts/ExpertCard";
import {
  ExpertProfileView,
  type ExpertProfileViewProps,
} from "@/components/experts/ExpertProfileView";
import Home from "@/app/home/page";
import { getSpecialties } from "@/app/actions/specialties";

jest.mock("@/app/actions/specialties", () => ({ getSpecialties: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ limit: async () => ({ data: [], error: null }) }),
    }),
  }),
}));
jest.mock("@/lib/auth/get-next-onboarding-step", () => ({
  getNextOnboardingStep: async () => "/my",
}));
jest.mock("@/lib/profile-versions/public", () => ({
  representativeCards: async (_db: unknown, rows: unknown[]) => rows,
}));
jest.mock("@/app/home/HomeSectionNav", () => ({ HomeSectionNav: () => null }));
jest.mock("@/components/experts/WorkplaceMap", () => ({
  WorkplaceMap: () => null,
}));

const hospital = { slug: "hospital-work", name: "병원 근무", is_primary: true };
const ordinary = {
  slug: "sports-performance",
  name: "스포츠·컨디셔닝",
  is_primary: true,
};
const expert = {
  id: "fixture",
  display_name: "테스트 전문가",
  professions: [],
  specialties: [hospital],
  headline: "소개",
  extra_links: [],
  experiences: [],
  academic_records: [],
  educations: [],
  licenses: [],
  workplace_external_contact_url: "https://example.test/legacy-inquiry",
  workplace_phone: "02-1234-5678",
} as unknown as ExpertProfileViewProps["expert"];
beforeEach(() => {
  jest.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = jest.fn();
  jest
    .mocked(getSpecialties)
    .mockResolvedValue({ ok: true, error: "", specialties: [] });
});
afterEach(cleanup);

test("catalog matches eleven ordered definitions and only hospital work has the preview medical flag", () => {
  expect(SPECIALTY_CATALOG.map((row) => row.name)).toEqual([
    "체중·체형관리",
    "근력·체력 향상",
    "자세·움직임 개선",
    "부상 후 리커버리",
    "스포츠·컨디셔닝",
    "필라테스·요가",
    "산전·산후",
    "소아·청소년",
    "시니어",
    "만성질환 운동",
    "병원 근무",
  ]);
  expect(
    SPECIALTY_CATALOG.filter((row) => row.medical_technician_only).map(
      (row) => row.slug,
    ),
  ).toEqual(["hospital-work"]);
  expect(SPECIALTY_PREVIEW_OPTIONS.map((row) => row.sort_order)).toEqual(
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  expect(HOSPITAL_WORK_SELECTION_NOTE).toBe(
    "현재 병원에서 근무 중인 경우에만 선택해주세요.",
  );
});

test("legacy slugs canonicalize and deduplicate without discarding unknown slugs", () => {
  expect(canonicalSpecialtySlug("conditioning")).toBe("sports-performance");
  expect(canonicalSpecialtySlug("sport-specific-training")).toBe(
    "sports-performance",
  );
  expect(
    canonicalSpecialtySlugs(
      " conditioning, sports-performance,sport-specific-training, hospital-work,unknown, ",
    ),
  ).toEqual(["sports-performance", "hospital-work", "unknown"]);
  expect(canonicalSpecialtySlugs(null)).toEqual([]);
  expect(canonicalSpecialtySlugs(undefined)).toEqual([]);
  expect(hasHospitalWork([ordinary])).toBe(false);
  expect(hasHospitalWork([hospital])).toBe(true);
});

test("directory keeps supplied DB names and sort order, supports preview fixtures and never mutates options", () => {
  const options = Object.freeze([
    {
      id: "h",
      slug: "hospital-work",
      name: "DB 병원 이름",
      sort_order: 20,
      medical_technician_only: true,
    },
    {
      id: "s",
      slug: "sports-performance",
      name: "DB 스포츠 이름",
      sort_order: 10,
    },
  ]);
  const { rerender } = render(<SpecialtyDirectory options={options} />);
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    expect.stringContaining("DB 스포츠 이름"),
    expect.stringContaining("DB 병원 이름"),
  ]);
  expect(screen.getAllByRole("link")[1].getAttribute("href")).toBe(
    "/experts?specialty=hospital-work",
  );
  expect(screen.getByText(HOSPITAL_WORK_NOTICE)).toBeTruthy();
  expect(options[0].id).toBe("h");
  rerender(<SpecialtyDirectory options={SPECIALTY_PREVIEW_OPTIONS} />);
  expect(screen.getAllByRole("link")).toHaveLength(11);
  rerender(<SpecialtyDirectory options={[]} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.queryByText(HOSPITAL_WORK_NOTICE)).toBeNull();
});

test("home renders only active DB action results without catalog name fallbacks", async () => {
  jest.mocked(getSpecialties).mockResolvedValueOnce({
    ok: true,
    error: "",
    specialties: [
      {
        id: "db",
        slug: "sports-performance",
        name: "현재 DB 이름",
        sort_order: 1,
      },
    ],
  });
  render(await Home());
  expect(getSpecialties).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: /현재 DB 이름/ })).toBeTruthy();
  expect(screen.queryByText("체중·체형관리")).toBeNull();
});

test("home reports unavailable directory without fabricating preview rows", async () => {
  jest.mocked(getSpecialties).mockResolvedValueOnce({
    ok: false,
    error: "unavailable",
    specialties: [],
  });
  render(await Home());
  expect(screen.getByRole("status").textContent).toContain("분야 목록을 잠시");
  expect(screen.queryByText("병원 근무")).toBeNull();
});

test("expert cards show the hospital notice only for a visible hospital specialty", () => {
  const { rerender } = render(
    <ExpertCard expert={expert as unknown as ExpertListItem} />,
  );
  expect(screen.getByText(HOSPITAL_WORK_NOTICE)).toBeTruthy();
  rerender(
    <ExpertCard
      expert={
        { ...expert, specialties: [ordinary] } as unknown as ExpertListItem
      }
    />,
  );
  expect(screen.queryByText(HOSPITAL_WORK_NOTICE)).toBeNull();
});

test("hospital profile suppresses new and legacy inquiry links while preserving phone, email, address and input", () => {
  const contact = Object.freeze({
    inquiry: Object.freeze({
      label: "문의하기",
      url: "https://example.test/new-inquiry",
    }),
    phone: "02-1234-5678",
    email: "public@example.test",
    address: Object.freeze({ base: "공개 주소", detail: "3층" }),
  });
  const { container } = render(
    <ExpertProfileView
      expert={{ ...expert, contact_inquiry: contact }}
      galleryImages={[]}
    />,
  );
  expect(screen.queryByText(HOSPITAL_WORK_NOTICE)).toBeNull();
  const tooltip = screen.getByText(HOSPITAL_WORK_TOOLTIP);
  const badge = tooltip.parentElement!;
  expect(badge.getAttribute("aria-describedby")).toBe(tooltip.id);
  expect(badge.tabIndex).toBe(0);
  fireEvent.focus(badge);
  fireEvent.keyDown(badge, { key: "Escape" });
  expect(tooltip.hidden).toBe(true);
  fireEvent.focus(badge);
  expect(tooltip.hidden).toBe(false);
  expect(
    container.querySelector('a[href="https://example.test/new-inquiry"]'),
  ).toBeNull();
  expect(
    container.querySelector('a[href="https://example.test/legacy-inquiry"]'),
  ).toBeNull();
  expect(container.querySelector('a[href="tel:0212345678"]')).toBeTruthy();
  expect(
    container.querySelector('a[href="mailto:public%40example.test"]'),
  ).toBeTruthy();
  expect(screen.getByText("공개 주소 3층")).toBeTruthy();
  expect(contact.inquiry.url).toBe("https://example.test/new-inquiry");
});

test("hospital legacy fallback retains phone but no inquiry CTA; ordinary profile behavior is preserved", () => {
  const { container, rerender } = render(
    <ExpertProfileView expert={expert} galleryImages={[]} />,
  );
  expect(
    container.querySelector('a[href="https://example.test/legacy-inquiry"]'),
  ).toBeNull();
  expect(container.querySelector('a[href="tel:02-1234-5678"]')).toBeTruthy();
  rerender(
    <ExpertProfileView
      expert={{
        ...expert,
        specialties: [ordinary],
        contact_inquiry: {
          inquiry: {
            label: "문의하기",
            url: "https://example.test/new-inquiry",
          },
        },
      }}
      galleryImages={[]}
    />,
  );
  expect(
    container.querySelector('a[href="https://example.test/new-inquiry"]'),
  ).toBeTruthy();
  expect(
    container.querySelector('a[href="https://example.test/legacy-inquiry"]'),
  ).toBeTruthy();
  expect(screen.queryByText(HOSPITAL_WORK_NOTICE)).toBeNull();
});
