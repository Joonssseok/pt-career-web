'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EducationStep() {
  const [certifications, setCertifications] = useState<Array<{
    id: string;
    name: string;
    issuer: string;
    issueDate: string;
  }>>([]);

  const [newCert, setNewCert] = useState({
    name: '',
    issuer: '',
    issueDate: '',
  });

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
    if (newCert.name && newCert.issuer) {
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

  const handleDeleteCertification = (id: string) => {
    setCertifications(certifications.filter((cert) => cert.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Education data:', certifications);
    // TODO: Save to database
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
            className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            + 자격증 추가
          </button>
        </div>

        {/* List Certifications */}
        {certifications.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">추가된 자격증</h3>
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{cert.name}</p>
                  <p className="text-sm text-gray-600">발급처: {cert.issuer}</p>
                  {cert.issueDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      {cert.issueDate}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCertification(cert.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/expert/onboarding/experience"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            이전
          </Link>
          <button
            type="submit"
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            다음: 전문분야
          </button>
        </div>
      </form>
    </div>
  );
}
