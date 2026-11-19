/** @jest-environment jsdom */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { trackEvent } from "@/lib/analytics";
jest.mock("@/lib/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/profile-sharing/qr", () => ({
  ...jest.requireActual("@/lib/profile-sharing/qr"),
  profileQrImage: jest.fn().mockResolvedValue("data:image/png;base64,aGVsbG8="),
}));
import { profileQrImage } from "@/lib/profile-sharing/qr";
const props = {
  profileId: "5caf08f5-0a7a-4ba4-a81d-38d668654ea5",
  displayName: "테스트 이름",
  headline: "공개된 소개",
};
const url = "https://ptcareer.co.kr/experts/" + props.profileId;
const copy = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: copy },
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});

test.each([
  { compact: false, preview: false },
  { compact: true, preview: false },
  { compact: false, preview: true },
  { compact: true, preview: true },
])("명함 UI 없이 링크·QR·카카오 공유를 유지한다: %j", async (mode) => {
  const { container } = render(
    <ProfileSharingTools {...props} {...mode} published />,
  );
  expect(container).not.toHaveTextContent("명함");
  expect(container.querySelector("details, canvas")).toBeNull();
  expect(
    screen.queryByRole("group", { name: "명함 디자인" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "공유 주소" })).toHaveValue(url);
  expect(
    screen.getByRole("button", { name: "링크 복사", exact: true }),
  ).toBeEnabled();
  expect(screen.getByRole("button", { name: "카카오톡 공유" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "QR코드", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "프로필 QR코드" });
  await within(dialog).findByRole("img", { name: "공개 프로필 QR코드" });
  expect(
    within(dialog).getByRole("button", { name: "QR 이미지 복사" }),
  ).toBeEnabled();
  expect(within(dialog).getByText("QR 이미지 저장")).toHaveAttribute(
    "aria-disabled",
    String(mode.preview),
  );
});

test("가입·초안 단계는 게시 이력 없이 공유를 제공하지 않음", () => {
  render(<ProfileSharingTools {...props} />);
  expect(
    screen.getByText("대표 프로필을 게시하면 공유할 수 있어요."),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("공유 주소")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "명함 이미지 저장" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
test("게시 이력 조회 실패는 미게시로 오인하거나 공유를 열지 않음", () => {
  render(<ProfileSharingTools {...props} published availabilityError />);
  expect(
    screen.getByText("공유 가능 상태를 확인하지 못했어요."),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("공유 주소")).not.toBeInTheDocument();
});
test("이름·소개를 바꿔도 공유 주소에 로컬 주소나 프로필 제목이 섞이지 않음", async () => {
  const view = render(<ProfileSharingTools {...props} published />);
  fireEvent.click(
    screen.getByRole("button", { name: "링크 복사", exact: true }),
  );
  await waitFor(() => expect(copy).toHaveBeenCalledWith(url));
  view.rerender(
    <ProfileSharingTools
      {...props}
      displayName="변경된 이름"
      headline="새 대표 소개"
      published
    />,
  );
  expect(screen.getByRole("textbox", { name: "공유 주소" })).toHaveValue(url);
  expect(trackEvent).toHaveBeenCalledTimes(1);
});
test("정식 도메인 QR을 열고 이미지 복사 미지원 시 저장을 안내한다", async () => {
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "QR코드", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "프로필 QR코드" });
  const image = await within(dialog).findByRole("img", {
    name: "공개 프로필 QR코드",
  });
  expect(image).toHaveAttribute("src", "data:image/png;base64,aGVsbG8=");
  expect(profileQrImage).toHaveBeenCalledWith(url);
  expect(
    within(dialog).getByRole("link", { name: "QR 이미지 저장" }),
  ).toBeEnabled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "QR 이미지 복사" }),
  );
  await waitFor(() =>
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "QR 이미지 저장을 이용해주세요",
    ),
  );
  expect(trackEvent).not.toHaveBeenCalled();
});

test("QR 이미지 복사는 PNG 데이터만 클립보드에 쓴다", async () => {
  const write = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: copy, write },
    configurable: true,
  });
  const original = global.ClipboardItem;
  const clipboardItem = jest.fn().mockImplementation((value) => ({ value }));
  Object.defineProperty(global, "ClipboardItem", {
    value: clipboardItem,
    configurable: true,
  });
  try {
    render(<ProfileSharingTools {...props} published />);
    fireEvent.click(
      screen.getByRole("button", { name: "QR코드", exact: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "프로필 QR코드" });
    await within(dialog).findByRole("img", { name: "공개 프로필 QR코드" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "QR 이미지 복사" }),
    );
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(clipboardItem.mock.calls[0][0]["image/png"]).toBeInstanceOf(Blob);
    expect(copy).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  } finally {
    Object.defineProperty(global, "ClipboardItem", {
      value: original,
      configurable: true,
    });
  }
});

test("QR 생성 실패는 재시도할 수 있고 이전 프로필 QR을 재사용하지 않는다", async () => {
  jest
    .mocked(profileQrImage)
    .mockRejectedValueOnce(new Error("qr-unavailable"));
  const view = render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "QR코드", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "프로필 QR코드" });
  expect(
    await within(dialog).findByText(/QR코드를 만들지 못했어요/),
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "다시 시도" }));
  await within(dialog).findByRole("img", { name: "공개 프로필 QR코드" });
  jest
    .mocked(profileQrImage)
    .mockImplementationOnce(() => new Promise(() => {}));
  view.rerender(
    <ProfileSharingTools {...props} profileId="new-profile" published />,
  );
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "QR 이미지 복사" }),
  ).toBeDisabled();
});

test("클립보드 실패는 성공으로 집계하지 않음", async () => {
  copy.mockRejectedValue(new Error("clipboard-denied"));
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(
    screen.getByRole("button", { name: "링크 복사", exact: true }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "선택된 주소를 직접 복사해주세요.",
    ),
  );
  expect(trackEvent).not.toHaveBeenCalled();
});
test("공유 메뉴가 없는 기기에서는 카카오톡 전송을 가장하지 않고 복사 안내", async () => {
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  expect(
    await screen.findByRole("dialog", { name: "카카오톡으로 공유하기" }),
  ).toBeInTheDocument();
  expect(trackEvent).not.toHaveBeenCalled();
  expect(copy).not.toHaveBeenCalled();
});
test("기기 공유 취소는 성공으로 집계하지 않음", async () => {
  const share = jest
    .fn()
    .mockRejectedValue(new DOMException("cancelled", "AbortError"));
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "카카오톡 공유" })).toBeEnabled(),
  );
  expect(share).toHaveBeenCalledWith({
    title: props.displayName + " · PT Career",
    text: props.headline,
    url,
  });
  expect(trackEvent).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test.each([false, true])(
  "기기 공유 성공만 집계한다: compact=%s",
  async (compact) => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: share,
      configurable: true,
    });
    render(<ProfileSharingTools {...props} compact={compact} published />);
    fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith("share"));
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: props.displayName + " · PT Career",
      text: props.headline,
      url,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);

test("QR 저장 링크는 PNG Blob 주소와 다운로드 파일명을 제공한다", async () => {
  render(<ProfileSharingTools {...props} published />);
  fireEvent.click(screen.getByRole("button", { name: "QR코드", exact: true }));
  const dialog = screen.getByRole("dialog", { name: "프로필 QR코드" });
  const link = await within(dialog).findByRole("link", {
    name: "QR 이미지 저장",
  });
  expect(link).toHaveAttribute("href", "blob:preview");
  expect(link).toHaveAttribute("download", "pt-career-qr.png");
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect((jest.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).type).toBe(
    "image/png",
  );
});
