'use server';

import { createClient } from '@/lib/supabase/server';

export type OwnEvidenceFile = {
  name: string;
  path: string;
  uploadedAt: string | null;
  sizeBytes: number | null;
};

// Storage 자체가 원장이다 — 라이선스 행이 삭제/교체돼도(save_own_licenses의
// delete+insert) evidence-files 버킷의 실제 파일은 어디에서도 지우지 않으므로,
// 본인 폴더를 나열하는 것만으로 과거 제출분까지 전부 다시 찾을 수 있다.
// 새 DB 테이블은 두지 않는다.
export async function listOwnEvidenceFiles() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: 'Not authenticated', files: [] as OwnEvidenceFile[] };
  }

  const { data, error } = await supabase.storage.from('evidence-files').list(user.id, {
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    console.error('[listOwnEvidenceFiles] Supabase error:', error);
    return { ok: false as const, error: error.message, files: [] as OwnEvidenceFile[] };
  }

  return {
    ok: true as const,
    error: '',
    files: (data ?? [])
      .filter((f) => f.id) // storage.list()가 폴더 placeholder를 함께 반환하는 경우 id가 없어 걸러낸다.
      .map((f) => ({
        name: f.name,
        path: `${user.id}/${f.name}`,
        uploadedAt: f.created_at ?? null,
        sizeBytes: (f.metadata as { size?: number } | null)?.size ?? null,
      })),
  };
}
