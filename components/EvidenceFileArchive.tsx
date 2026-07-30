import { listOwnEvidenceFiles } from '@/app/actions/evidence-files';
import { getEvidenceFileUrl } from '@/lib/storage/evidence-file-url';

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

export async function EvidenceFileArchive() {
  const result = await listOwnEvidenceFiles();

  if (!result.ok) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-900">제출 서류함</p>
        <p className="text-xs text-gray-500 mt-0.5">
          지금까지 제출한 증빙 파일입니다. 자격증을 수정·삭제해도 파일은 폐기되지 않고 여기서 계속 열람할 수 있습니다.
        </p>
      </div>

      {result.files.length === 0 ? (
        <p className="text-sm text-gray-400">제출한 증빙 파일이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {result.files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <a
                href={getEvidenceFileUrl(f.path) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 truncate"
              >
                📎 {f.name}
              </a>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {f.uploadedAt && new Date(f.uploadedAt).toLocaleDateString('ko-KR')}
                {f.sizeBytes != null && ` · ${formatBytes(f.sizeBytes)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
