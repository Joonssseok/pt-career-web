// Add or reorder a notice here; the confirmation dialog renders the list automatically.
const PUBLISH_NOTICES = [
  {
    id: "public-information",
    title: "공개 정보 확인",
    description:
      "게시할 소개·이력과 연락처·주소의 공개 설정을 다시 확인해주세요.",
  },
  {
    id: "evidence-privacy",
    title: "개인정보 가림",
    description:
      "증빙자료의 주민등록번호 뒷자리·개인 연락처 등 불필요한 개인정보는 가려주세요.",
  },
  {
    id: "evidence-visibility",
    title: "증빙자료 공개",
    description:
      "파일은 기본 비공개입니다. 공개로 선택한 파일도 관리자 승인 후에만 표시됩니다.",
  },
  {
    id: "information-accuracy",
    title: "내용의 정확성",
    description: "게시할 이력·자격·소개가 사실과 일치하는지 확인해주세요.",
  },
] as const;

export function ProfilePublishNotices() {
  return (
    <section aria-labelledby="profile-publish-notices-title" className="mt-5">
      <h3
        id="profile-publish-notices-title"
        className="text-sm font-semibold text-slate-900"
      >
        게시 전 주의사항
      </h3>
      <ol
        aria-label="게시 전 주의사항"
        className="mt-3 list-decimal space-y-4 pl-5 marker:text-slate-400"
      >
        {PUBLISH_NOTICES.map((notice) => (
          <li key={notice.id} className="pl-1">
            <p className="text-sm font-medium text-slate-800">{notice.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {notice.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
