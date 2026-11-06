import { formatActivityPeriod } from "../lib/activity-period";

test.each([
  ["2026", "2026년"],
  ["2026년", "2026년"],
  ["2026-12", "2026년 12월"],
  ["2026년 12월", "2026년 12월"],
  ["26년 12월 ~ 27년 4월", "2026년 12월 ~ 2027년 4월"],
  ["2026. 10. 24.", "2026년 10월 24일"],
  ["20220204", "2022년 2월 4일"],
  ["202612", "2026년 12월"],
  ["2025–현재", "2025년 ~ 현재"],
  ["2026-2027", "2026년 ~ 2027년"],
  ["2024-02-29", "2024년 2월 29일"],
  ["2026-02-29", "2026-02-29"],
  ["2026-13", "2026-13"],
  ["2026년 상반기, 30시간", "2026년 상반기, 30시간"],
  ["", ""],
])(
  "formats %s without discarding precision or legacy text",
  (input, expected) => {
    expect(formatActivityPeriod(input)).toBe(expected);
    expect(formatActivityPeriod(expected)).toBe(expected);
  },
);
