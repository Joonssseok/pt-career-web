/** @jest-environment jsdom */
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { FeedbackWorkspace } from "../components/feedback/FeedbackWorkspace";
import { SiteFooter } from "../components/SiteFooter";
import { validateFeedback, type FeedbackInput } from "../lib/feedback";
import { submitFeedback } from "../app/actions/feedback";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("../app/actions/feedback", () => ({ submitFeedback: jest.fn() }));
const base: FeedbackInput = {
  kind: "suggestion",
  category: "서비스 개선",
  subject: "검색 개선",
  body: "검색 결과에서 지역을 선택하고 싶어요.",
  page_url: "",
};
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "11111111-1111-4111-8111-111111111111"),
  });
});
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});
test("validates category, content and unsafe page URLs", () => {
  expect(validateFeedback(base)).toBe("");
  expect(validateFeedback({ ...base, kind: "report" })).toContain("분류");
  expect(validateFeedback({ ...base, body: "짧음" })).toContain("10");
  expect(
    validateFeedback({ ...base, page_url: "javascript:alert(1)" }),
  ).not.toBe("");
  expect(
    validateFeedback({ ...base, page_url: "https://user:secret@example.com" }),
  ).not.toBe("");
});
test("footer puts feedback immediately after privacy", () => {
  render(<SiteFooter />);
  const links = screen
    .getByRole("navigation", { name: "서비스 안내" })
    .querySelectorAll("a");
  expect(links[2].textContent).toBe("개인정보처리방침");
  expect(links[3].textContent).toBe("제안·신고");
  expect(links[3].getAttribute("href")).toBe("/feedback");
});
test("logged-out visitor sees sign-in, not private records or a submit button", () => {
  render(<FeedbackWorkspace signedIn={false} initialTickets={[]} />);
  expect(
    screen.getByRole("link", { name: "로그인하기" }).getAttribute("href"),
  ).toBe("/login?next=/my/feedback");
  expect(screen.queryByRole("button", { name: "제안 보내기" })).toBeNull();
});
test("failed submission preserves content and request id when retrying", async () => {
  (submitFeedback as jest.Mock)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({
      ok: true,
      id: "11111111-1111-4111-8111-111111111111",
    });
  render(<FeedbackWorkspace signedIn initialTickets={[]} />);
  fireEvent.change(screen.getByLabelText("제목"), {
    target: { value: base.subject },
  });
  fireEvent.change(screen.getByLabelText("내용"), {
    target: { value: base.body },
  });
  fireEvent.click(screen.getByRole("button", { name: "제안 보내기" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("내용")).toHaveProperty("value", base.body);
  const id = (submitFeedback as jest.Mock).mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", { name: "제안 보내기" }));
  await screen.findByText("접수되었습니다.");
  expect((submitFeedback as jest.Mock).mock.calls[1][0]).toBe(id);
  expect(screen.getByLabelText("내용")).toHaveProperty("value", "");
});
test("unavailable storage cannot show a fake successful receipt", () => {
  render(<FeedbackWorkspace signedIn initialTickets={[]} ready={false} />);
  expect(
    (screen.getByRole("button", { name: "제안 보내기" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByText("접수되었습니다.")).toBeNull();
});
test("report mode selects report categories and history uses real status and reply", () => {
  render(
    <FeedbackWorkspace
      signedIn
      initialTickets={[
        {
          ...base,
          id: "test",
          status: "resolved",
          reply: "의견을 반영했습니다.",
          created_at: "2026-11-02T01:00:00Z",
          updated_at: "2026-11-02T02:00:00Z",
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "신고", exact: true }));
  expect(screen.getByLabelText("분류")).toHaveProperty(
    "value",
    "허위 프로필·이력",
  );
  expect(screen.getByRole("button", { name: "신고 접수" })).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "내 접수 내역" }));
  expect(screen.getByText("처리 완료")).toBeTruthy();
  expect(screen.getByText("의견을 반영했습니다.")).toBeTruthy();
});
