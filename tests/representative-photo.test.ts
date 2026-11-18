import { representativeExpert } from "../lib/profile-versions/public";
import type { Representative } from "../lib/profile-versions/types";

const representative = {
  profile_id: "profile",
  expert: {
    id: "profile",
    profile_image_path: "owner/old.jpg",
    headline: "old headline",
    experiences: [{ organization_name: "Published workplace" }],
    academic_records: [],
    educations: [],
    licenses: [],
  },
  content: {
    headline: "Published headline",
    introduction: "Published introduction",
    sections: ["experiences"],
    activities: [],
  },
  gallery: [],
} as unknown as Representative;

test("public profile uses the current portrait while keeping published history and content", () => {
  const result = representativeExpert(representative, {
    profile_image_path: "owner/new.jpg",
  });
  expect(result.profile_image_path).toBe("owner/new.jpg");
  expect(result.headline).toBe("Published headline");
  expect(result.experiences).toEqual(representative.expert.experiences);
  expect(representative.expert.profile_image_path).toBe("owner/old.jpg");
});

test("removing the current portrait does not restore an old published portrait", () => {
  expect(
    representativeExpert(representative, { profile_image_path: null })
      .profile_image_path,
  ).toBeNull();
});

test("refreshing the portrait preserves hidden history", () => {
  const result = representativeExpert(
    {
      ...representative,
      content: { ...representative.content, sections: [] },
    },
    { profile_image_path: "owner/new.jpg" },
  );
  expect(result.experiences).toEqual([]);
});
