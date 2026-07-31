'use client';

// 항목별 공개/비공개 토글 — 클릭 즉시 전용 RPC를 호출해 확정된다("저장" 버튼과
// 무관, 낙관적 UI 업데이트). 마스터 토글이 꺼져 있으면(disabled) 값과 무관하게
// 비활성화되고 안내 문구가 나타난다.
export function VisibilityToggle({
  visible,
  onToggle,
  disabled = false,
  pending = false,
}: {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  // 마스터 토글이 꺼져 있으면(disabled) 저장된 실제 값(visible)과 무관하게
  // 항상 "비공개"로 표시한다 — 실제로 공개 프로필에서 안 보이는 상태와
  // 화면 표시를 일치시키기 위함. 저장된 값 자체는 바뀌지 않는다(마스터를
  // 다시 켜면 이 항목의 이전 값이 그대로 복원된다).
  const displayVisible = disabled ? false : visible;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || pending}
      className={`min-h-[32px] px-3 text-xs font-medium rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        displayVisible
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {pending ? '변경 중...' : displayVisible ? '공개' : '비공개'}
    </button>
  );
}
