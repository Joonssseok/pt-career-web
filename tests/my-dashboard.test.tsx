/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MyDashboard, type MyDashboardData } from "@/app/my/MyDashboard";
import { ProfileSharingTools } from "@/components/ProfileSharingTools";
import { trackEvent } from "@/lib/analytics";
jest.mock("@/lib/analytics", () => ({ trackEvent: jest.fn() }));

const data: MyDashboardData = {
  name: "테스트 회원",
  headline: "소개",
  photoUrl: null,
  profileId: "person",
  canShare: true,
  published: true,
  availabilityError: false,
  versions: [
    {
      id: "private-version",
      title: "관리용 제목",
      updatedAt: "2026-11-08T00:00:00Z",
      representative: true,
    },
  ],
  versionCount: 1,
  activityCount: 0,
  fileCount: 0,
  pendingCount: 0,
  activities: [],
  reviews: [],
  activityError: false,
  reviewError: false,
};

test("관리용 제목은 편집으로, 공개 프로필은 회원에게 고정된 주소로 연결", () => {
  render(<MyDashboard data={data} sharing={<div>공유 도구</div>} />);
  expect(screen.getByRole("link", { name: /관리용 제목/ })).toHaveAttribute(
    "href",
    "/my/profiles?profile=private-version",
  );
  expect(
    screen.getByRole("link", { name: /공개 프로필 보기/ }),
  ).toHaveAttribute("href", "/experts/person");
  expect(screen.queryByRole("link", { name: /이력서 다운로드/ })).not.toBeInTheDocument();
});

test("조회 실패는 기록 0건이나 비어 있는 심사 내역으로 오인하지 않음", () => {
  render(
    <MyDashboard
      data={{
        ...data,
        activityCount: null,
        fileCount: null,
        pendingCount: null,
        activityError: true,
        reviewError: true,
      }}
      sharing={null}
    />,
  );
  const summary = screen.getByRole("navigation", { name: "내 활동 요약" });
  expect(within(summary).getAllByText("확인 필요")).toHaveLength(3);
  expect(
    screen.getByText(/활동 기록을 불러오지 못했습니다/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/심사 내역을 불러오지 못했습니다/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("접수된 심사 내역이 없습니다."),
  ).not.toBeInTheDocument();
});

test("미게시·비공개 상태에 공개 프로필 링크를 제공하지 않음", () => {
  render(
    <MyDashboard
      data={{ ...data, canShare: false, published: false }}
      sharing={null}
    />,
  );
  expect(
    screen.queryByRole("link", { name: /공개 프로필 보기/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /프로필 관리로 이동/ }),
  ).toHaveAttribute("href", "/my/profiles");
});

test("예시 화면의 공유 조작은 클립보드·전송·통계에 영향을 주지 않음", () => {
  const copy = jest.fn();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
  render(
    <ProfileSharingTools
      compact
      preview
      profileId="example"
      published
      displayName="예시"
      headline="예시 소개"
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "링크 복사", exact: true }),
  );
  expect(copy).not.toHaveBeenCalled();
  expect(trackEvent).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(
    "예시 화면에서는 링크를 복사하지 않습니다.",
  );
  expect(screen.getByRole("button", { name: /QR코드 복사/ })).toBeDisabled();
});
