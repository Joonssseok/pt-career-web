import ExpertsPage from "@/app/experts/page";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

jest.mock("next/navigation", () => ({ redirect: jest.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/app/actions/specialties", () => ({ getSpecialties: jest.fn() }));
jest.mock("@/app/actions/professions", () => ({ getProfessions: jest.fn() }));
jest.mock("@/lib/auth/get-next-onboarding-step", () => ({ getNextOnboardingStep: jest.fn() }));
jest.mock("@/app/experts/ExpertFilters", () => ({ ExpertFilters: () => null }));
jest.mock("@/app/experts/LoadMoreExperts", () => ({ LoadMoreExperts: () => null, EXPERTS_PAGE_SIZE: 20 }));
beforeEach(() => jest.clearAllMocks());

test.each(["conditioning", "sport-specific-training", "conditioning,sport-specific-training,sports-performance"])("legacy specialty URL %s redirects once and preserves the other filters", async specialty => {
  await expect(ExpertsPage({ searchParams: Promise.resolve({ specialty, profession: "personal-trainer", region: "서울", query: "이름" }) })).rejects.toThrow("redirect:");
  const destination = (redirect as unknown as jest.Mock).mock.calls[0][0];
  const url = new URL(destination, "http://localhost");
  expect(url.searchParams.get("specialty")).toBe("sports-performance");
  expect(url.searchParams.get("profession")).toBe("personal-trainer");
  expect(url.searchParams.get("region")).toBe("서울");
  expect(url.searchParams.get("query")).toBe("이름");
  expect(createClient).not.toHaveBeenCalled();
});
test("canonical specialty URLs render without a redirect loop", async () => {
  await ExpertsPage({ searchParams: Promise.resolve({ specialty: "sports-performance" }) });
  expect(redirect).not.toHaveBeenCalled();
});
