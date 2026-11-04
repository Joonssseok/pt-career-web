/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileUnavailable } from "@/components/ProfileUnavailable";
import { getUnavailableProfileState, isProfileId } from "@/lib/profile-sharing/access";
const rpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc }) }));
beforeEach(() => rpc.mockReset());

test("비공개 안내는 주석대로 짧게 표시", () => {
  render(<ProfileUnavailable state="private" />);
  expect(screen.getByText("프로필 정보를 확인할 수 없습니다.")).toBeInTheDocument();
  expect(screen.queryByText(/작성자가|지금은/)).not.toBeInTheDocument();
});
test("제공 종료 화면은 삭제 요청한 두 설명을 표시하지 않음", () => {
  render(<ProfileUnavailable state="unavailable" />);
  expect(screen.getByRole("heading", { name: "더 이상 제공되지 않는 프로필입니다." })).toBeInTheDocument();
  expect(screen.queryByText(/계정 탈퇴로|다른 사람의 프로필|QR코드/)).not.toBeInTheDocument();
});
test("고정 프로필 번호만 허용", () => {
  expect(isProfileId("5caf08f5-0a7a-4ba4-a81d-38d668654ea5")).toBe(true);
  expect(isProfileId("not-a-profile")).toBe(false);
});
test.each(["private", "unavailable"])("상태만 사용하고 비공개 정보를 요청하지 않음: %s", async state => {
  rpc.mockResolvedValue({ data: state, error: null });
  expect(await getUnavailableProfileState("fixed-id")).toBe(state);
  expect(rpc).toHaveBeenCalledWith("profile_access_status", { p_profile_id: "fixed-id" });
});
test("서버 오류를 탈퇴 상태로 잘못 표시하지 않음", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "NETWORK" } });
  await expect(getUnavailableProfileState("id")).rejects.toThrow("프로필 공개 상태를 확인하지 못했습니다.");
  rpc.mockResolvedValue({ data: "public", error: null });
  await expect(getUnavailableProfileState("id")).rejects.toThrow();
});
test("서버 함수 미적용 시 기존 404로 안전하게 복귀", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  expect(await getUnavailableProfileState("id")).toBeNull();
});
