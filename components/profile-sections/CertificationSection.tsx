'use client';

import { useEffect, useState } from 'react';
import { getOwnCertifications, saveCertifications } from '@/app/actions/certification';
import { createClient } from '@/lib/supabase/client';
import { getEvidenceFileUrl } from '@/lib/storage/evidence-file-url';
import { LICENSE_STATUS_META } from '@/lib/constants/status-badges';

type Certification = {
  id: string;
  name: string;
  category: string;
  issuer: string;
  issueDate: string;
  documentPath: string;
  // 방금 추가해 아직 저장 전인 항목은 서버 상태가 없다 — undefined는
  // "검토 대기"(not_submitted와 동일한 의미)로 취급한다.
  verificationStatus?: string;
};

const LICENSE_CATEGORIES = [
  '국가면허',
  '국가자격',
  '민간자격',
  '교육수료',
  '세미나수료',
  '교육활동',
  '봉사활동',
];

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const EVIDENCE_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

type Props = {
  // 저장 성공 시 호출. 다음 단계로 이동할지, 그 자리에 머물지는 호출부가 결정한다.
  onSaved: () => void;
  submitLabel: string;
  savedMessage?: string;
  leftNav?: React.ReactNode;
};

export default function CertificationSection({
  onSaved,
  submitLabel,
  savedMessage = '✓ 저장되었습니다!',
  leftNav,
}: Props) {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [newCert, setNewCert] = useState({
    name: '',
    category: '',
    issuer: '',
    issueDate: '',
    documentPath: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newCert | null>(null);
  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    getOwnCertifications().then((result) => {
      if (!result.ok) return;
      setCertifications(result.certifications);
    });
  }, []);

  const commonCerts = [
    'ISSA CPT',
    'NASM-CPT',
    'ACE CPT',
    'IFBB Pro Card',
    '필라테스 자격증',
    '요가 자격증',
    '헬스케어 운동사',
    '스포츠 마사지 자격증',
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
      setFileError('jpg, png, pdf 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      setFileError('10MB 이하의 파일만 업로드할 수 있습니다');
      return;
    }

    setFileError('');
    setFileUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFileError('로그인이 필요합니다');
        return;
      }

      const ext = EVIDENCE_EXT_BY_TYPE[file.type];
      // Random filename, not tied to a license row id — saveCertifications
      // deletes and re-inserts every license row on each save, so a path
      // keyed by the (unstable) license id would break on re-save.
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence-files')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setFileError(`업로드에 실패했습니다: ${uploadError.message}`);
        return;
      }

      setNewCert((prev) => ({ ...prev, documentPath: path }));
    } finally {
      setFileUploading(false);
    }
  };

  const handleAddCertification = () => {
    if (newCert.name.trim() && newCert.issuer.trim()) {
      setCertifications([
        ...certifications,
        {
          id: Date.now().toString(),
          ...newCert,
        },
      ]);
      setNewCert({
        name: '',
        category: '',
        issuer: '',
        issueDate: '',
        documentPath: '',
      });
    }
  };

  const handleEditStart = (cert: Certification) => {
    setEditingId(cert.id);
    setEditForm({
      name: cert.name,
      category: cert.category,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
      documentPath: cert.documentPath,
    });
  };

  const handleEditSave = (id: string) => {
    if (editForm) {
      setCertifications(
        certifications.map((cert) =>
          cert.id === id ? { ...cert, ...editForm } : cert
        )
      );
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDeleteCertification = (id: string) => {
    setCertifications(certifications.filter((cert) => cert.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormState('loading');

    const result = await saveCertifications({
      certifications: certifications.map((cert) => ({
        id: cert.id,
        certName: cert.name,
        category: cert.category,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        documentPath: cert.documentPath,
      })),
    });

    if (result.ok) {
      setFormState('saved');
      onSaved();
    } else {
      setFormState('default');
      alert(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Add New Certification */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">자격증 추가</h3>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">
            자격증명
          </label>
          <input
            type="text"
            list="common-certs"
            placeholder="예: ISSA CPT"
            value={newCert.name}
            onChange={(e) =>
              setNewCert({
                ...newCert,
                name: e.target.value,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="common-certs">
            {commonCerts.map((cert) => (
              <option key={cert} value={cert} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">
            카테고리
          </label>
          <select
            value={newCert.category}
            onChange={(e) =>
              setNewCert({
                ...newCert,
                category: e.target.value,
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">선택 안 함</option>
            {LICENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              발급처
            </label>
            <input
              type="text"
              placeholder="예: ISSA"
              value={newCert.issuer}
              onChange={(e) =>
                setNewCert({
                  ...newCert,
                  issuer: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              발급일
            </label>
            <input
              type="month"
              value={newCert.issueDate}
              onChange={(e) =>
                setNewCert({
                  ...newCert,
                  issueDate: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">
            증빙 파일 (선택)
          </label>
          {newCert.documentPath ? (
            <div className="flex items-center justify-between bg-white border border-gray-300 rounded-lg px-4 py-2">
              <span className="text-sm text-blue-600 font-medium">✓ 업로드 완료</span>
              <button
                type="button"
                onClick={() => setNewCert((prev) => ({ ...prev, documentPath: '' }))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                제거
              </button>
            </div>
          ) : (
            <label className="block bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors">
              <span className="text-sm text-gray-600">
                {fileUploading ? '⏳ 업로드 중...' : '📎 증빙 파일 업로드'}
              </span>
              <p className="text-xs text-gray-500 mt-1">jpg, png, pdf / 10MB 이하</p>
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                disabled={fileUploading}
                className="hidden"
              />
            </label>
          )}
          {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
        </div>

        <button
          type="button"
          onClick={handleAddCertification}
          className="w-full min-h-[44px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
        >
          + 자격증 추가
        </button>
      </div>

      {/* State Messages */}
      {formState === 'loading' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 font-medium">⏳ 저장 중입니다...</p>
        </div>
      )}

      {formState === 'saved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-900 font-medium">{savedMessage}</p>
        </div>
      )}

      {/* List Certifications */}
      {certifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">추가된 자격증 ({certifications.length})</h3>
          {certifications.map((cert) => (
            <div key={cert.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              {editingId === cert.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm?.name || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="자격증명"
                  />
                  <input
                    type="text"
                    value={editForm?.issuer || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm!,
                        issuer: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="발급처"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(cert.id)}
                      className="min-h-[44px] px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={handleEditCancel}
                      className="min-h-[44px] px-4 py-2 bg-gray-300 text-gray-900 text-sm rounded hover:bg-gray-400 flex items-center justify-center"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {cert.name}
                        {cert.category && (
                          <span className="ml-2 text-xs text-gray-500">{cert.category}</span>
                        )}
                        {(() => {
                          const meta =
                            LICENSE_STATUS_META[cert.verificationStatus ?? 'not_submitted'] ??
                            LICENSE_STATUS_META.not_submitted;
                          return (
                            <span
                              className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
                            >
                              {meta.label}
                            </span>
                          );
                        })()}
                      </p>
                      <p className="text-sm text-gray-600">발급처: {cert.issuer}</p>
                      {cert.issueDate && (
                        <p className="text-xs text-gray-500 mt-1">{cert.issueDate}</p>
                      )}
                      {cert.documentPath && (
                        <a
                          href={getEvidenceFileUrl(cert.documentPath) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          📎 증빙 파일 보기
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditStart(cert)}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-blue-500 hover:text-blue-700 font-medium flex items-center justify-center"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCertification(cert.id)}
                        className="min-h-[44px] min-w-[44px] px-3 py-2 text-red-500 hover:text-red-700 font-medium flex items-center justify-center"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        {leftNav}
        <button
          type="submit"
          disabled={formState === 'loading'}
          className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center"
        >
          {formState === 'loading' ? '저장 중...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
