// 관리자 해제 전까지 /my 방문 때마다 계속 노출한다(닫기/다시 보지 않기
// 없음 -- 정책 확정 사항). 되돌리기는 관리자만 할 수 있으므로 이 배너에는
// 액션 버튼이 없다(DeletionBanner와 달리 사용자가 직접 취소할 수 없음).
export function SuspensionBanner({
  suspendedAt,
  suspensionReason,
}: {
  suspendedAt: string;
  suspensionReason: string | null;
}) {
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
      <p className="text-sm text-amber-900 font-medium">
        {suspensionReason ? `${suspensionReason} 사유로 ` : ''}임시조치되었습니다.
      </p>
      <p className="text-xs text-amber-800">
        조치일시: {new Date(suspendedAt).toLocaleString('ko-KR')}
      </p>
      <p className="text-xs text-amber-800">
        프로필 편집은 계속 가능하지만, 임시조치가 해제되기 전까지 공개 게시(제출/공개 전환)는
        제한됩니다.
      </p>
    </div>
  );
}
