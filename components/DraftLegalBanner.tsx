export function DraftLegalBanner() {
  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-8">
      <p className="text-sm font-bold text-yellow-900">
        ⚠️ 본 문서는 초안이며 법률 검토 전입니다 (DRAFT — 최종 문구 아님)
      </p>
      <p className="text-xs text-yellow-800 mt-1">
        실제 서비스 반영 전 대표 확인 및 변호사 검토가 필요합니다.
      </p>
    </div>
  );
}
