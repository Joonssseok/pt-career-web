/** @jest-environment jsdom */
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import {
  ContactInquiryCard,
  ContactInquiryFields,
  emptyContactInquiry,
} from "@/components/profile-editor/ContactInquiryPreview";
import { searchNaverBusinesses } from "@/app/actions/naver-location-search";
import { searchNaverAddresses } from "@/lib/naver-maps-browser";
jest.mock("@/app/actions/naver-location-search", () => ({
  searchNaverBusinesses: jest.fn(),
}));
jest.mock("@/lib/naver-maps-browser", () => ({
  searchNaverAddresses: jest.fn(),
  loadNaverMaps: jest.fn(() =>
    Promise.resolve({ LatLng: jest.fn(), Map: jest.fn(), Marker: jest.fn() }),
  ),
}));
afterEach(cleanup);
function Preview() {
  const [value, setValue] = useState(emptyContactInquiry);
  return (
    <>
      <ContactInquiryFields value={value} onChange={setValue} />
      <ContactInquiryCard value={value} />
    </>
  );
}
test("optional contacts appear only when filled and individually public", () => {
  render(<Preview />);
  expect(
    screen.queryByRole("region", { name: "연락·문의 안내 미리보기" }),
  ).toBeNull();
  fireEvent.click(screen.getByLabelText("공개 전화번호 공개"));
  expect(
    screen.queryByRole("region", { name: "연락·문의 안내 미리보기" }),
  ).toBeNull();
});
test("public contact preview validates links and reacts without saving", () => {
  render(<Preview />);
  fireEvent.change(screen.getByLabelText("문의 링크", { exact: true }), {
    target: { value: "javascript:alert(1)" },
  });
  fireEvent.click(screen.getByLabelText("문의 링크 공개"));
  expect(screen.queryByRole("link", { name: "수업 문의하기" })).toBeNull();
  fireEvent.change(screen.getByLabelText("문의 링크", { exact: true }), {
    target: { value: "https://example.com/contact" },
  });
  fireEvent.change(screen.getByLabelText("버튼 문구"), {
    target: { value: "운동 문의하기" },
  });
  expect(
    screen.getByRole("link", { name: "운동 문의하기" }).getAttribute("href"),
  ).toBe("https://example.com/contact");
  fireEvent.change(screen.getByLabelText("공개 이메일", { exact: true }), {
    target: { value: "hello@example.com" },
  });
  expect(screen.queryByRole("link", { name: "hello@example.com" })).toBeNull();
  fireEvent.click(screen.getByLabelText("공개 이메일 공개"));
  expect(
    screen
      .getByRole("link", { name: "hello@example.com" })
      .getAttribute("href"),
  ).toBe("mailto:hello%40example.com");
  fireEvent.change(screen.getByLabelText("공개 전화번호", { exact: true }), {
    target: { value: "02-0000-0000" },
  });
  fireEvent.click(screen.getByLabelText("공개 전화번호 공개"));
  expect(
    screen.getByRole("link", { name: "02-0000-0000" }).getAttribute("href"),
  ).toBe("tel:0200000000");
  const card = within(
    screen.getByRole("region", { name: "연락·문의 안내 미리보기" }),
  );
  fireEvent.click(screen.getByLabelText("공개 이메일 공개"));
  expect(card.queryByRole("link", { name: "hello@example.com" })).toBeNull();
});

test("NAVER selections keep address and map privacy separate and clear old unit on replacement", async () => {
  const location = {
    name: "테스트 센터",
    address: "성남시 산성대로 106",
    latitude: 37.44,
    longitude: 127.14,
  };
  jest
    .mocked(searchNaverBusinesses)
    .mockResolvedValue({ ok: true, locations: [location] });
  jest
    .mocked(searchNaverAddresses)
    .mockResolvedValue([
      { ...location, name: "", address: "성남시 산성대로 108" },
    ]);
  render(<Preview />);
  expect(
    (screen.getByLabelText("지도 공개") as HTMLInputElement).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("네이버 업체명 검색"), {
    target: { value: "테스트 센터" },
  });
  fireEvent.click(screen.getByRole("button", { name: "검색", exact: true }));
  fireEvent.click(
    await screen.findByRole("button", { name: /테스트 센터.*선택/ }),
  );
  fireEvent.change(screen.getByLabelText("상세주소"), {
    target: { value: "3층" },
  });
  expect(
    screen.queryByRole("region", { name: "연락·문의 안내 미리보기" }),
  ).toBeNull();
  fireEvent.click(screen.getByLabelText("지도 공개"));
  expect(
    await screen.findByRole("img", { name: "선택한 근무지 위치 지도" }),
  ).toBeTruthy();
  const card = within(
    screen.getByRole("region", { name: "연락·문의 안내 미리보기" }),
  );
  expect(card.queryByText(/산성대로/)).toBeNull();
  expect(card.queryByText("테스트 센터")).toBeNull();
  fireEvent.click(screen.getByLabelText("방문 주소 공개"));
  expect(card.getByText("성남시 산성대로 106 3층")).toBeTruthy();
  expect(card.getByText("테스트 센터")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("지도 공개"));
  expect(card.queryByRole("img")).toBeNull();
  expect(card.getByText("성남시 산성대로 106 3층")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "주소", exact: true }));
  fireEvent.change(screen.getByLabelText("네이버 주소 검색"), {
    target: { value: "산성대로 108" },
  });
  fireEvent.click(screen.getByRole("button", { name: "검색", exact: true }));
  fireEvent.click(
    await screen.findByRole("button", { name: /산성대로 108.*선택/ }),
  );
  await waitFor(() =>
    expect((screen.getByLabelText("상세주소") as HTMLInputElement).value).toBe(
      "",
    ),
  );
  expect(card.getByText("성남시 산성대로 108")).toBeTruthy();
  expect(card.queryByText("테스트 센터")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "주소 선택 해제" }));
  expect(screen.getByLabelText("방문 주소", { exact: true })).toHaveProperty(
    "value",
    "",
  );
  expect(screen.getByLabelText("상세주소")).toHaveProperty("value", "");
  expect(screen.getByLabelText("지도 공개")).toHaveProperty("checked", false);
  expect(screen.getByLabelText("지도 공개")).toHaveProperty("disabled", true);
});
