import {
  activityForProfile,
  applyVersion,
  BASE_SECTIONS,
  type VersionContent,
} from "../lib/profile-versions/types";
import type { ExpertProfileViewProps } from "../components/experts/ExpertProfileView";
const base = {
  id: "fixed-person-id",
  headline: "공개 소개",
  introduction: "원래 소개",
  experiences: [{ organization_name: "기관" }],
  academic_records: [],
  educations: [],
  licenses: [{ license_name: "자격" }],
  total_experience_years: 4,
} as unknown as ExpertProfileViewProps["expert"];
const content: VersionContent = {
  headline: "다른 소개",
  introduction: "새 소개",
  sections: [],
  activities: [],
};
test("대표 교체 시 원래 공유 ID를 유지하고 원본 객체를 변경하지 않음", () => {
  const next = applyVersion(base, content);
  expect(next.id).toBe(base.id);
  expect(next.headline).toBe("다른 소개");
  expect(base.headline).toBe("공개 소개");
});
test("숨긴 공통 이력과 경력 연수는 표시하지 않음", () => {
  const next = applyVersion(base, content);
  expect(next.experiences).toEqual([]);
  expect(next.licenses).toEqual([]);
  expect(next.total_experience_years).toBeNull();
});
test("선택한 이력만 다시 표시", () => {
  const next = applyVersion(base, {
    ...content,
    sections: BASE_SECTIONS.map((s) => s.id),
  });
  expect(next.experiences).toEqual(base.experiences);
  expect(next.licenses).toEqual(base.licenses);
});

test("activity region overrides only this profile's display and keeps workplace privacy", () => {
  const source = {
    ...base,
    workplace_region: "경기",
    workplace_address: "비공개 주소",
  };
  const next = applyVersion(source, {
    ...content,
    activityRegion: "서울",
    excluded: ["workplace:0"],
  });
  expect(next.workplace_region).toBe("서울");
  expect(next.workplace_address).toBeNull();
  expect(source.workplace_region).toBe("경기");
  expect(
    applyVersion(source, { ...content, activityRegion: "" }).workplace_region,
  ).toBeNull();
  expect(applyVersion(source, content).workplace_region).toBe("경기");
});
test("다모아를 가져올 때 개인 메모·첨부 원본·내부 소유자를 전달하지 않음", () => {
  const row = {
    id: "record",
    title: "봉사",
    period: "2026",
    description: "공개할 활동",
    learning: "배운 점",
    memo: "비공개 메모",
    owner: "private-user",
    files: [{ name: "private.pdf" }],
  };
  const publicItem = activityForProfile(row, "봉사활동");
  expect(Object.keys(publicItem).sort()).toEqual(
    ["id", "category", "title", "period", "description", "learning"].sort(),
  );
  expect(JSON.stringify(publicItem)).not.toContain("비공개 메모");
  expect(JSON.stringify(publicItem)).not.toContain("private.pdf");
});

test("saved exclusions remove the same history after base rows reorder, without mutating the source", () => {
  const { profileItemKey } = require("../lib/profile-versions/types");
  const row = base.experiences[0];
  const key = profileItemKey("experiences", row);
  const next = applyVersion(
    { ...base, experiences: [{ ...row, organization_name: "다른 기관" }, row] },
    {
      ...content,
      sections: ["experiences"],
      excluded: [key, "introduction:0", "workplace:0"],
    },
  );
  expect(next.experiences.map((row) => row.organization_name)).toEqual([
    "다른 기관",
  ]);
  expect(next.introduction).toBeNull();
  expect(next.workplace_phone).toBeNull();
  expect(next.total_experience_years).toBeNull();
  expect(base.experiences).toHaveLength(1);
});
test("license identity ignores public-document metadata and selected activities respect exclusions", () => {
  const {
    profileItemKey,
    publicActivities,
  } = require("../lib/profile-versions/types");
  expect(
    profileItemKey("licenses", {
      license_name: "자격",
      id: "one",
      document_public: false,
    }),
  ).toBe(
    profileItemKey("licenses", {
      document_public: true,
      id: "two",
      license_name: "자격",
    }),
  );
  const row = {
    id: "activity",
    title: "기록",
    category: "활동",
    period: "",
    description: "",
    learning: "",
  };
  expect(
    publicActivities({
      ...content,
      activities: [row],
      excluded: ["damoa:activity"],
    }),
  ).toEqual([]);
});

test("server JSONB object key ordering does not leave saved content marked dirty", () => {
  const { sameProfileContent } = require("../lib/profile-versions/types");
  const saved = {
    ...content,
    order: { sections: ["experiences", "licenses"] },
    excluded: [],
  };
  const reread = {
    excluded: [],
    order: { sections: ["experiences", "licenses"] },
    activities: [],
    sections: [],
    introduction: "새 소개",
    headline: "다른 소개",
  };
  expect(sameProfileContent(saved, reread)).toBe(true);
  expect(
    sameProfileContent(saved, {
      ...reread,
      order: { sections: ["licenses", "experiences"] },
    }),
  ).toBe(false);
});
