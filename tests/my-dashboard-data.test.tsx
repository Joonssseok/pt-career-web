/** @jest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import MyPage from "@/app/my/page";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => client),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("redirect");
  }),
}));
jest.mock("@/components/AccountSidebar", () => ({
  AccountSidebar: () => null,
}));
jest.mock("@/components/ProfileVisibilityToggle", () => ({
  ProfileVisibilityToggle: () => null,
}));
jest.mock("@/components/ProfileSharingTools", () => ({
  ProfileSharingTools: () => null,
}));
jest.mock("@/app/my/DeletionBanner", () => ({ DeletionBanner: () => null }));
jest.mock("@/app/my/SuspensionBanner", () => ({
  SuspensionBanner: () => null,
}));

type Request = { table: string; columns: string; filters: [string, unknown][] };
let requests: Request[];
let activityFailure = false;
const client = {
  auth: {
    getUser: jest.fn(async () => ({ data: { user: { id: "current-owner" } } })),
  },
  rpc: jest.fn(async () => ({ data: [], error: null })),
  from(table: string) {
    const request: Request = { table, columns: "", filters: [] };
    requests.push(request);
    const chain = {
      select(columns: string) {
        request.columns = columns;
        return chain;
      },
      eq(column: string, value: unknown) {
        request.filters.push([column, value]);
        return chain;
      },
      order() {
        return chain;
      },
      in() {
        return chain;
      },
      not() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        return chain;
      },
      then(resolve: (value: unknown) => unknown) {
        let data: unknown = [],
          count: number | null = 0,
          error: unknown = null;
        if (table === "profiles")
          data = {
            id: "own-person",
            display_name: "테스트 회원",
            verification_status: "approved",
            owner_visible: true,
            is_public: true,
          };
        if (table === "profile_versions") {
          data =
            request.columns === "published_at"
              ? { published_at: "2026-11-08" }
              : [
                  {
                    id: "version",
                    title: "내 프로필",
                    updated_at: "2026-11-08",
                    is_representative: true,
                  },
                ];
          count = 7;
        }
        if (table === "damoa_activities") {
          data = [
            {
              id: "activity",
              title: "나의 활동",
              category: "education",
              updated_at: "2026-11-08",
            },
          ];
          count = 12;
          if (activityFailure) {
            data = null;
            count = null;
            error = { code: "TEST_FAILURE" };
          }
        }
        if (table === "damoa_files") count = 8;
        if (table === "profile_item_reviews") count = 2;
        return Promise.resolve({ data, count, error }).then(resolve);
      },
    };
    return chain;
  },
};

beforeEach(() => {
  requests = [];
  activityFailure = false;
});

test("요약은 목록 일부가 아닌 전체 건수를 사용하고 모든 조회를 로그인 회원으로 한정", async () => {
  render(await MyPage());
  const summary = screen.getByRole("navigation", { name: "내 활동 요약" });
  expect(
    within(summary).getByRole("link", { name: /내 프로필 7\s*개/ }),
  ).toBeInTheDocument();
  expect(
    within(summary).getByRole("link", { name: /활동 기록 12\s*건/ }),
  ).toBeInTheDocument();
  expect(screen.getByText("교육·연수")).toBeInTheDocument();
  for (const request of requests) {
    expect(request.filters).toContainEqual([
      request.table === "profiles"
        ? "user_id"
        : request.table.startsWith("damoa_")
          ? "owner"
          : "owner_id",
      "current-owner",
    ]);
  }
});

test("서버 조회 오류를 활동 0건으로 바꾸지 않음", async () => {
  activityFailure = true;
  render(await MyPage());
  const summary = screen.getByRole("navigation", { name: "내 활동 요약" });
  expect(
    within(summary).getByRole("link", { name: "활동 기록 확인 필요" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/활동 기록을 불러오지 못했습니다/),
  ).toBeInTheDocument();
});
