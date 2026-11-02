export const FEEDBACK_CATEGORIES = {
  suggestion: ["서비스 개선", "기능 제안", "오류 제보", "기타 의견"],
  report: ["허위 프로필·이력", "부적절한 내용", "개인정보 침해", "기타 신고"],
} as const;
export type FeedbackKind = keyof typeof FEEDBACK_CATEGORIES;
export type FeedbackInput = {
  kind: FeedbackKind;
  category: string;
  subject: string;
  body: string;
  page_url: string;
};
export type FeedbackTicket = FeedbackInput & {
  id: string;
  status: "submitted" | "reviewing" | "resolved";
  reply: string;
  created_at: string;
  updated_at: string;
};
export const FEEDBACK_STATUS = {
  submitted: "접수",
  reviewing: "확인 중",
  resolved: "처리 완료",
};
export function receiptNumber(id: string) {
  return "PT-" + id.replace(/-/g, "").toUpperCase();
}
export function validateFeedback(input: FeedbackInput): string {
  if (
    !input ||
    !Object.prototype.hasOwnProperty.call(FEEDBACK_CATEGORIES, input.kind)
  )
    return "제안 또는 신고를 선택해주세요.";
  if (
    !(FEEDBACK_CATEGORIES[input.kind] as readonly string[]).includes(
      input.category,
    )
  )
    return "분류를 선택해주세요.";
  if (
    typeof input.subject !== "string" ||
    !input.subject.trim() ||
    input.subject.trim().length > 100
  )
    return "제목은 1~100자로 입력해주세요.";
  if (
    typeof input.body !== "string" ||
    input.body.trim().length < 10 ||
    input.body.trim().length > 5000
  )
    return "내용은 10~5,000자로 입력해주세요.";
  if (typeof input.page_url !== "string" || input.page_url.length > 2000)
    return "관련 페이지 주소를 확인해주세요.";
  if (input.page_url.trim()) {
    try {
      const url = new URL(input.page_url.trim());
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return "http 또는 https 페이지 주소를 입력해주세요.";
    } catch {
      return "올바른 페이지 주소를 입력해주세요.";
    }
  }
  return "";
}
