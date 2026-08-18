// 섹션 구분용 얇은 점선 모티프. 장식 요소라 스크린리더에서는 숨긴다.
export function MotionPath() {
  return (
    <div aria-hidden className="flex justify-center py-6">
      <svg width="120" height="8" viewBox="0 0 120 8" fill="none">
        <line
          x1="0"
          y1="4"
          x2="120"
          y2="4"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
