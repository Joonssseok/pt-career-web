/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { trackEvent } from "@/lib/analytics";
jest.mock("@/lib/analytics", () => ({ trackEvent: jest.fn() }));
const props = { profileId: "5caf08f5-0a7a-4ba4-a81d-38d668654ea5", displayName: "테스트 이름", headline: "공개된 소개" };
const url = "https://pt-career-web.vercel.app/experts/" + props.profileId;
const copy = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: copy }, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});

test("가입·초안 단계는 게시 이력 없이 공유·명함을 제공하지 않음", () => {
  render(<ProfileSharingTools {...props} />);
  expect(screen.getByText("대표 프로필을 게시하면 공유할 수 있어요.")).toBeInTheDocument();
  expect(screen.queryByLabelText("공유 주소")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "명함 이미지 저장" })).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
test("게시 이력 조회 실패는 미게시로 오인하거나 공유를 열지 않음", () => {
  render(<ProfileSharingTools {...props} published availabilityError />);
  expect(screen.getByText("공유 가능 상태를 확인하지 못했어요.")).toBeInTheDocument();
  expect(screen.queryByLabelText("공유 주소")).not.toBeInTheDocument();
});
test("이름·소개를 바꿔도 공유 주소에 로컬 주소나 프로필 제목이 섞이지 않음", async () => {
  const view = render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "링크 복사", exact: true }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(url));
  view.rerender(<ProfileSharingTools {...props} displayName="변경된 이름" headline="새 대표 소개" published />);
  expect(screen.getByRole("textbox", { name: "공유 주소" })).toHaveValue(url);
  expect(trackEvent).toHaveBeenCalledTimes(1);
});
test("정식 도메인 결정 전 QR 복사 비활성·QR 이미지 없음", () => {
  render(<ProfileSharingTools {...props} published />);
  expect(screen.getByRole("button", { name: /QR코드 복사/ })).toBeDisabled();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
test("클립보드 실패는 성공으로 집계하지 않음", async () => {
  copy.mockRejectedValue(new Error("clipboard-denied"));
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "링크 복사", exact: true }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("선택된 주소를 직접 복사해주세요."));
  expect(trackEvent).not.toHaveBeenCalled();
});
test("공유 메뉴가 없는 기기에서는 카카오톡 전송을 가장하지 않고 복사 안내", async () => {
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  expect(await screen.findByRole("dialog", { name: "카카오톡으로 공유하기" })).toBeInTheDocument();
  expect(trackEvent).not.toHaveBeenCalled();
  expect(copy).not.toHaveBeenCalled();
});
test("기기 공유 취소는 성공으로 집계하지 않음", async () => {
  const share = jest.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "카카오톡 공유" })).toBeEnabled());
  expect(share).toHaveBeenCalledWith({ title: props.displayName + " · PT Career", text: props.headline, url });
  expect(trackEvent).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
