import { representativeCards } from "../lib/profile-versions/public";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpertListItem } from "../app/experts/ExpertCard";
test("search cards respect the published removal of career and workplace details", async () => {
  const base = {
    id: "one",
    display_name: "이름",
    headline: "기존 소개",
    total_experience_years: 10,
    workplace_region: "지역",
    workplace_center_name: "제외한 기관",
  } as ExpertListItem;
  const rpc = jest.fn(async () => ({
    data: [
      {
        profile_id: "one",
        content: { headline: "공개 소개" },
        expert: {
          display_name: "이름",
          total_experience_years: null,
          workplace_region: null,
          workplace_center_name: null,
        },
      },
    ],
    error: null,
  }));
  const [card] = await representativeCards(
    { rpc } as unknown as SupabaseClient,
    [base],
  );
  expect(card.headline).toBe("공개 소개");
  expect(card.total_experience_years).toBeNull();
  expect(card.workplace_center_name).toBeNull();
  expect(base.workplace_center_name).toBe("제외한 기관");
});
