'use client';

import { useEffect, useState } from 'react';
import { getAdminAuditLog, type AdminAuditLogEntry, type AdminUserOption } from '@/app/actions/admin';

const PAGE_SIZE = 20;

const ACTION_LABEL: Record<string, string> = {
  profile_approved: '승인',
  profile_rejected: '반려',
};

export function AuditLog({ admins }: { admins: AdminUserOption[] }) {
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actionType, setActionType] = useState('');
  const [adminUserId, setAdminUserId] = useState('');

  const fetchPage = async (offset: number, append: boolean) => {
    setLoading(true);
    const result = await getAdminAuditLog({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      actionType: (actionType || undefined) as 'profile_approved' | 'profile_rejected' | undefined,
      adminUserId: adminUserId || undefined,
      limit: PAGE_SIZE,
      offset,
    });
    setLoading(false);
    setLoaded(true);

    if (!result.ok) return;

    setEntries((prev) => (append ? [...prev, ...result.entries] : result.entries));
    setHasMore(result.entries.length === PAGE_SIZE);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchPage(0, false);
  }, []);

  return (
    <div className="space-y-3">
      <div className="p-4 bg-white rounded-lg border border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-xs text-gray-600 space-y-1">
          <span className="block">시작일</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 space-y-1">
          <span className="block">종료일</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 space-y-1">
          <span className="block">결정 유형</span>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            <option value="profile_approved">승인</option>
            <option value="profile_rejected">반려</option>
          </select>
        </label>
        <label className="text-xs text-gray-600 space-y-1">
          <span className="block">처리 관리자</span>
          <select
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {admins.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.email ?? a.user_id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => fetchPage(0, false)}
        disabled={loading}
        className="min-h-[44px] px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? '조회 중...' : '조회'}
      </button>

      {loaded && entries.length === 0 && (
        <div className="p-8 text-center text-gray-500 text-sm bg-white rounded-lg border border-gray-200">
          조건에 맞는 이력이 없습니다.
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {entries.map((e) => (
            <div key={e.id} className="p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    e.action_type === 'profile_approved'
                      ? 'text-green-700 font-medium'
                      : 'text-red-700 font-medium'
                  }
                >
                  {ACTION_LABEL[e.action_type] ?? e.action_type}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(e.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="text-gray-900 mt-1">{e.target_display_name ?? '이름 미입력'}</p>
              {e.memo && <p className="text-gray-600 mt-0.5">사유: {e.memo}</p>}
              <p className="text-xs text-gray-400 mt-1">처리: {e.admin_email ?? e.admin_user_id}</p>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => fetchPage(entries.length, true)}
          disabled={loading}
          className="w-full min-h-[44px] py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}
