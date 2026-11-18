/** @jest-environment jsdom */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NaverAccountLink } from "../components/auth/NaverAccountLink";
const linkIdentity = jest.fn();
jest.mock("../lib/supabase/client", () => ({
  createClient: () => ({ auth: { linkIdentity } }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  linkIdentity.mockResolvedValue({ error: null });
});
afterEach(cleanup);

test("links Naver to the session instead of starting a separate login and blocks duplicate clicks", async () => {
  render(<NaverAccountLink enabled linked={false} />);
  const button = screen.getByRole("button", { name: "네이버 연결" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(linkIdentity).toHaveBeenCalledTimes(1));
  const args = linkIdentity.mock.calls[0][0];
  expect(args.provider).toBe("custom:naver");
  const callback = new URL(args.options.redirectTo);
  expect(callback.origin).toBe(window.location.origin);
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("link")).toBe("naver");
  expect(callback.searchParams.get("next")).toBe("/my/personal");
});

test("linked accounts show server-confirmed status without another connect button", () => {
  render(<NaverAccountLink enabled linked />);
  expect(screen.getByText("연결됨")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

test("failure is controlled and a restored mobile page can retry", async () => {
  linkIdentity.mockRejectedValueOnce(new Error("private-fixture"));
  render(<NaverAccountLink enabled linked={false} />);
  fireEvent.click(screen.getByRole("button", { name: "네이버 연결" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("다시 로그인"),
  );
  expect(screen.getByRole("alert").textContent).not.toContain(
    "private-fixture",
  );
  fireEvent.click(screen.getByRole("button", { name: "네이버 연결" }));
  await waitFor(() => expect(linkIdentity).toHaveBeenCalledTimes(2));
  act(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
    false,
  );
});
