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
  const label = pending ? '변경 중...' : displayVisible ? '공개' : '비공개';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`text-xs font-medium ${displayVisible ? 'text-green-700' : 'text-gray-500'}`}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={displayVisible}
        aria-label={label}
        onClick={onToggle}
        disabled={disabled || pending}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          displayVisible ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            displayVisible ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </span>
  );
}
