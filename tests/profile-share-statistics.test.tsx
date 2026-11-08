/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileHeaderActions, ShareButton } from "@/app/experts/[id]/ShareButton";
import { trackEvent } from "@/lib/analytics";
jest.mock("@/lib/analytics", () => ({ trackEvent: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test("링크 복사 성공 이후 제외 규칙이 있는 수집 경로만 사용", async () => {
  const copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: copy },
    configurable: true,
  });
  render(
    <ProfileHeaderActions
      profileId="test"
      displayName="테스트"
      headline={null}
      shareUrl="https://example.com/profile"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "프로필 공유하기" }));
  await waitFor(() => expect(trackEvent).toHaveBeenCalledWith("share"));
  expect(copy).toHaveBeenCalledWith("https://example.com/profile");
  expect(screen.getByText("링크가 복사되었습니다")).toBeInTheDocument();
});

test("별표는 준비 안내만 열고 공유나 저장을 실행하지 않음", () => {
  const original = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const showModal = jest.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: showModal, configurable: true });
  const copy = jest.fn();
  const share = jest.fn();
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: copy }, configurable: true });
  render(<ProfileHeaderActions profileId="test" displayName="테스트" headline={null} />);
  fireEvent.click(screen.getByRole("button", { name: "프로필 즐겨찾기" }));
  expect(screen.getByRole("dialog", { name: "기능 준비 안내" })).toHaveTextContent("준비중인 기능입니다");
  expect(showModal).toHaveBeenCalledTimes(1);
  expect(share).not.toHaveBeenCalled();
  expect(copy).not.toHaveBeenCalled();
  expect(trackEvent).not.toHaveBeenCalled();
  if (original) Object.defineProperty(HTMLDialogElement.prototype, "showModal", original);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});
test("공유 취소는 집계하지 않음", async () => {
  const share = jest.fn().mockRejectedValue(new Error("cancel"));
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
  render(<ShareButton profileId="test" displayName="테스트" headline={null} />);
  fireEvent.click(screen.getByRole("button", { name: "프로필 공유하기" }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(trackEvent).not.toHaveBeenCalled();
});
