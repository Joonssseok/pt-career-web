/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ShareButton } from "@/app/experts/[id]/ShareButton";
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
    <ShareButton
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
