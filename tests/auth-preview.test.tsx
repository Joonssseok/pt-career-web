/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthPreview, AuthPreviewGuard } from "../app/preview/auth/preview";

afterEach(cleanup);

test("preview switches the actual embedded form and mobile viewport", () => {
  render(<AuthPreview />);
  fireEvent.click(screen.getByRole("button", { name: "모바일" }));
  let frame = screen.getByTitle("모바일 로그인 미리보기") as HTMLIFrameElement;
  expect(frame.style.width).toBe("390px");
  fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
  frame = screen.getByTitle("모바일 회원가입 미리보기") as HTMLIFrameElement;
  expect(frame.getAttribute("src")).toBe("/preview/auth?frame=1&mode=signup");
  fireEvent.click(screen.getByRole("button", { name: "PC" }));
  expect(
    (screen.getByTitle("PC 회원가입 미리보기") as HTMLIFrameElement).style
      .width,
  ).toBe("100%");
});

test("preview blocks real OAuth clicks and form submission while keeping inputs usable", () => {
  const authenticate = jest.fn();
  render(
    <AuthPreviewGuard>
      <form aria-label="예시 로그인" onSubmit={authenticate}>
        <input aria-label="예시 이메일" />
        <button type="button" onClick={authenticate}>
          Google로 계속하기
        </button>
        <button type="submit">이메일로 로그인</button>
      </form>
    </AuthPreviewGuard>,
  );
  fireEvent.change(screen.getByLabelText("예시 이메일"), {
    target: { value: "fixture@example.invalid" },
  });
  expect((screen.getByLabelText("예시 이메일") as HTMLInputElement).value).toBe(
    "fixture@example.invalid",
  );
  fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));
  fireEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));
  fireEvent.submit(screen.getByRole("form", { name: "예시 로그인" }));
  expect(authenticate).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain(
    "실제 로그인이나 회원가입은 진행되지 않아요",
  );
});
