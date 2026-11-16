import { workplaceFromActivity } from "../lib/profile-versions/workplace";
import {
  applyVersion,
  type VersionContent,
} from "../lib/profile-versions/types";
import type { Activity } from "../lib/damoa/categories";
import type { ExpertProfileViewProps } from "../components/experts/ExpertProfileView";

const activity = {
  id: "00000000-0000-4000-8000-000000000001",
  category: "career",
  title: "근무 기록",
  details: {
    "기관·회사명": "공식 기관",
    "근무지 주소": "서울특별시 중구 세종대로 110",
    "기관 전화": "02-1234-5678",
    "기관 홈페이지": "https://example.com",
    "담당 업무": "비공개 업무",
  },
} as unknown as Activity;
const base = {
  id: "person",
  headline: "",
  introduction: "",
  experiences: [],
  academic_records: [],
  educations: [],
  licenses: [],
  workplace_center_name: "이전 기관",
  workplace_address: "이전 주소",
  workplace_external_contact_url: "https://old.example.com",
} as unknown as ExpertProfileViewProps["expert"];
const content: VersionContent = {
  headline: "",
  introduction: "",
  sections: [],
  activities: [],
};

test("only explicit workplace fields enter the profile snapshot; the original stays unchanged", () => {
  const snapshot = workplaceFromActivity(activity);
  expect(Object.keys(snapshot).sort()).toEqual(
    ["sourceActivityId", "centerName", "address", "phone", "websiteUrl"].sort(),
  );
  expect(snapshot.centerName).toBe("공식 기관");
  expect(activity.details["담당 업무"]).toBe("비공개 업무");
  expect(
    applyVersion(base, { ...content, currentWorkplace: snapshot })
      .workplace_address,
  ).toBe(snapshot.address);
  expect(base.workplace_address).toBe("이전 주소");
});

test("legacy profiles are unchanged, explicit removal and hiding both clear workplace fields", () => {
  expect(applyVersion(base, content).workplace_address).toBe(
    base.workplace_address,
  );
  expect(
    applyVersion(base, { ...content, currentWorkplace: null })
      .workplace_address,
  ).toBeNull();
  const hidden = applyVersion(base, {
    ...content,
    currentWorkplace: workplaceFromActivity(activity),
    excluded: ["workplace:0"],
    activityRegion: "서울",
  });
  expect(hidden.workplace_center_name).toBeNull();
  expect(hidden.workplace_address).toBeNull();
  expect(hidden.workplace_website_url).toBeNull();
  expect(hidden.workplace_region).toBe("서울");
});

test.each([
  "javascript:alert(1)",
  "https://user:password@example.com",
  "not-a-url",
])("rejects unsafe institution URLs: %s", (url) => {
  expect(() =>
    workplaceFromActivity({
      ...activity,
      details: { ...activity.details, "기관 홈페이지": url },
    }),
  ).toThrow();
});
test("non-career records cannot be selected as a workplace", () =>
  expect(() =>
    workplaceFromActivity({ ...activity, category: "license" }),
  ).toThrow());
