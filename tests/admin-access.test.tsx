import AdminDashboardPage from "@/app/admin/page";
import { createClient } from "@/lib/supabase/server";
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/app/actions/admin", () => ({
  getAdminDashboardStats: jest.fn(),
  getAdminReviewKpis: jest.fn(),
  getAdminUsersList: jest.fn(),
}));
jest.mock("@/components/feedback/AdminFeedbackQueue", () => ({
  AdminFeedbackQueue: () => null,
}));
jest.mock("@/app/admin/EvidenceReviewQueue", () => ({
  EvidenceReviewQueue: () => null,
}));
jest.mock("@/app/admin/AuditLog", () => ({ AuditLog: () => null }));
jest.mock("@/app/admin/AllProfilesList", () => ({
  AllProfilesList: () => null,
}));
test("미로그인 사용자는 관리자 자료 조회 전 로그인으로 이동", async () => {
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    rpc: jest.fn(),
    from: jest.fn(),
  };
  (createClient as jest.Mock).mockResolvedValue(client);
  await expect(
    AdminDashboardPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("REDIRECT:/login?next=/admin");
  expect(client.rpc).not.toHaveBeenCalled();
  expect(client.from).not.toHaveBeenCalled();
});
test("관리자 권한 조회 오류는 자료를 공개하지 않는다", async () => {
  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "test" } } }),
    },
    rpc: jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: "unavailable" } }),
    from: jest.fn(),
  };
  (createClient as jest.Mock).mockResolvedValue(client);
  await expect(
    AdminDashboardPage({ searchParams: Promise.resolve({ view: "ads" }) }),
  ).rejects.toThrow("REDIRECT:/");
  expect(client.from).not.toHaveBeenCalled();
});
