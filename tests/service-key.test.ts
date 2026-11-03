import { normalizeServiceKey } from "@/lib/supabase/service-key";
const legacy = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
test("server key normalization accepts exact supported keys", () => {
  expect(normalizeServiceKey(legacy)).toBe(legacy);
  expect(normalizeServiceKey("sb_secret_test_only")).toBe(
    "sb_secret_test_only",
  );
});
test("removes a separate legacy line label and surrounding whitespace", () => {
  expect(normalizeServiceKey(`123456-\n${legacy}\n`)).toBe(legacy);
  expect(normalizeServiceKey(`label\r\n  ${legacy} `)).toBe(legacy);
});
test("malformed or fragmented values fail closed", () => {
  for (const value of [
    undefined,
    "",
    "not-a-key",
    "sb_secret_test\nonly",
    `${legacy} trailing`,
  ])
    expect(normalizeServiceKey(value)).toBeUndefined();
});
