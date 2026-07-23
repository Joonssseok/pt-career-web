'use client';

import { useState } from 'react';
import Link from 'next/link';

type Certification = {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
};

export default function EducationStep() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [newCert, setNewCert] = useState({
    name: '',
    issuer: '',
    issueDate: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof newCert | null>(null);
  const [formState, setFormState] = useState<'default' | 'loading' | 'saved'>('default');

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
        issuer: '',
        issueDate: '',
      });
    }
  };

  const handleEditStart = (cert: Certification) => {
    setEditingId(cert.id);
    setEditForm({
      name: cert.name,
      issuer: cert.issuer,
      issueDate: cert.issueDate,
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
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setFormState('saved');
    setTimeout(() => setFormState('default'), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">🎓</span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">교육 이력</h2>
          <p className="text-sm text-gray-600">
            보유한 자격증과 교육을 추가해주세요 (선택사항)
          </p>
        </div>
      </div>

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
            <p className="text-sm text-green-900 font-medium">✓ 저장되었습니다!</p>
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
                        <p className="font-medium text-gray-900">{cert.name}</p>
                        <p className="text-sm text-gray-600">발급처: {cert.issuer}</p>
                        {cert.issueDate && (
                          <p className="text-xs text-gray-500 mt-1">{cert.issueDate}</p>
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
          <Link
            href="/expert/onboarding/experience"
            className="min-h-[44px] px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            이전
          </Link>
          <button
            type="submit"
            disabled={formState === 'loading'}
            className="flex-1 min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 flex items-center justify-center"
          >
            {formState === 'loading' ? '저장 중...' : '다음: 전문분야'}
          </button>
        </div>
      </form>
    </div>
  );
}
