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
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || pending}
      className={`min-h-[32px] px-3 text-xs font-medium rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        visible
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
      }`}
    >
      {pending ? '변경 중...' : visible ? '공개' : '비공개'}
    </button>
  );
}
