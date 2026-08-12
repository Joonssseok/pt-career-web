'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  getOwnAcademicRecords,
  saveAcademicRecords,
  setOwnAcademicRecordVisibility,
  type AcademicLevel,
} from '@/app/actions/academic-record';
import { searchSchools, searchUniversities, type SchoolSearchResult } from '@/app/actions/school-search';
import { VisibilityToggle } from './VisibilityToggle';
import { YearMonthSelect } from './YearMonthSelect';
import type { SectionSaveHandle } from './types';

type AcademicRecord = {
  id: string;
  level: AcademicLevel;
  degree: string;
  schoolName: string;
  major: string;
  startDate: string;
  endDate: string;
  ownerVisible: boolean;
};

const LEVEL_OPTIONS: Array<{ value: AcademicLevel; label: string }> = [
  { value: 'graduate', label: '대학원' },
  { value: 'university', label: '대학교' },
  { value: 'high_school', label: '고등학교' },
  { value: 'middle_school', label: '중학교' },
];
const LEVEL_LABELS: Record<AcademicLevel, string> = {
  graduate: '대학원',
  university: '대학교',
  high_school: '고등학교',
  middle_school: '중학교',
};

const DEGREE_OPTIONS = ['석사', '박사'];

// 졸업년월 내림차순 -- 없으면 입학년월 내림차순으로 그 아래 배치. 1절
// 교육이력 자동정렬과 동일한 규칙(일관성을 위한 판단, 보고서 참고).
function sortAcademicRecordsByRecency(items: AcademicRecord[]): AcademicRecord[] {
  const withEnd = items.filter((r) => r.endDate);
  const withoutEnd = items.filter((r) => !r.endDate);
  const byDateDesc = (key: 'endDate' | 'startDate') => (a: AcademicRecord, b: AcademicRecord) =>
    a[key] > b[key] ? -1 : a[key] < b[key] ? 1 : 0;

  return [...[...withEnd].sort(byDateDesc('endDate')), ...[...withoutEnd].sort(byDateDesc('startDate'))];
}

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const AcademicSection = forwardRef<SectionSaveHandle, Props>(function AcademicSection(
  { profileOwnerVisible = true },
  ref
) {
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    getOwnAcademicRecords().then((result) => {
      if (!result.ok) return;
      setRecords(result.academicRecords);
    });
  }, []);

  const handleToggleVisibility = async (id: string) => {
    const target = records.find((r) => r.id === id);
    if (!target) return;

    const nextVisible = !target.ownerVisible;
    setTogglingId(id);
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ownerVisible: nextVisible } : r)));

    const result = await setOwnAcademicRecordVisibility(id, nextVisible);
    if (!result.ok) {
      setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ownerVisible: !nextVisible } : r)));
      alert(result.error);
    }
    setTogglingId(null);
  };

  const [newRecord, setNewRecord] = useState<{
    level: AcademicLevel | '';
    degree: string;
    schoolName: string;
    major: string;
    startDate: string;
    endDate: string;
  }>({
    level: '',
    degree: '',
    schoolName: '',
    major: '',
    startDate: '',
    endDate: '',
  });

  // 학교명 검색 자동완성 -- 구분에 따라 서로 다른 데이터 소스를 쓴다.
  // 고등학교/중학교는 NEIS 학교기본정보(초중등 전용), 대학교/대학원은 정적으로
  // 번들링한 전국대학정보(대학원도 소속 대학교명으로 검색 -- 세부 대학원
  // 프로그램명이 아님)를 쓴다. 두 함수 모두 실패 시 조용히 빈 배열만 돌려주므로
  // 결과가 없으면 자유 텍스트 입력으로 그대로 이어진다.
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRequestId = useRef(0);
  const searchFnForLevel =
    newRecord.level === 'high_school' || newRecord.level === 'middle_school'
      ? searchSchools
      : newRecord.level === 'university' || newRecord.level === 'graduate'
        ? searchUniversities
        : null;

  useEffect(() => {
    const query = newRecord.schoolName;
    if (!searchFnForLevel || query.trim().length < 2) {
      setSchoolSuggestions([]);
      return;
    }
    const requestId = ++searchRequestId.current;
    const timer = setTimeout(() => {
      searchFnForLevel(query).then((results) => {
        if (requestId === searchRequestId.current) {
          setSchoolSuggestions(results);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [newRecord.schoolName, searchFnForLevel]);

  const handleSelectSuggestion = (s: SchoolSearchResult) => {
    setNewRecord((prev) => ({ ...prev, schoolName: s.name }));
    setSchoolSuggestions([]);
    setShowSuggestions(false);
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ schoolName: string; major: string } | null>(null);

  const handleAddRecord = () => {
    if (!newRecord.level || !newRecord.schoolName.trim()) return;

    setRecords([
      ...records,
      {
        id: Date.now().toString(),
        level: newRecord.level,
        degree: newRecord.level === 'graduate' ? newRecord.degree : '',
        schoolName: newRecord.schoolName,
        major: newRecord.level === 'graduate' || newRecord.level === 'university' ? newRecord.major : '',
        startDate: newRecord.startDate,
        endDate: newRecord.endDate,
        ownerVisible: true,
      },
    ]);
    setNewRecord({ level: '', degree: '', schoolName: '', major: '', startDate: '', endDate: '' });
    setSchoolSuggestions([]);
    setShowSuggestions(false);
  };

  const handleEditStart = (r: AcademicRecord) => {
    setEditingId(r.id);
    setEditForm({ schoolName: r.schoolName, major: r.major });
  };

  const handleEditSave = (id: string) => {
    if (editForm) {
      setRecords(records.map((r) => (r.id === id ? { ...r, ...editForm } : r)));
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleDeleteRecord = (id: string) => {
    setRecords(records.filter((r) => r.id !== id));
  };

  const save = async (): Promise<{ ok: boolean; error?: string }> => {
    const result = await saveAcademicRecords({
      records: sortAcademicRecordsByRecency(records).map((r) => ({
        id: r.id,
        level: r.level,
        degree: r.degree,
        schoolName: r.schoolName,
        major: r.major,
        startDate: r.startDate,
        endDate: r.endDate,
        ownerVisible: r.ownerVisible,
      })),
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  useImperativeHandle(ref, () => ({ save }), [records]);

  const showDegreeField = newRecord.level === 'graduate';
  const showMajorField = newRecord.level === 'graduate' || newRecord.level === 'university';
  // 대학원은 세부 프로그램명이 아니라 소속 대학교명으로 검색·저장한다(지시서 5-a).
  const schoolNameLabel = newRecord.level === 'graduate' ? '소속 대학교명' : '학교명';

  return (
    <div className="space-y-5">
      {!profileOwnerVisible && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별 공개 설정이 적용됩니다.
          </p>
        </div>
      )}

      {/* Add New Academic Record */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">학력 추가</h3>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">구분</label>
          <select
            value={newRecord.level}
            onChange={(e) =>
              setNewRecord((prev) => ({ ...prev, level: e.target.value as AcademicLevel | '' }))
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">구분을 선택해주세요</option>
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {showDegreeField && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">학위</label>
            <select
              value={newRecord.degree}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, degree: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택 안 함</option>
              {DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="relative">
          <label className="text-xs font-medium text-gray-600 mb-2 block">{schoolNameLabel}</label>
          <input
            type="text"
            placeholder="예: 서울대학교"
            value={newRecord.schoolName}
            onChange={(e) => {
              setNewRecord((prev) => ({ ...prev, schoolName: e.target.value }));
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showSuggestions && schoolSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {schoolSuggestions.map((s) => (
                <li key={`${s.code}-${s.name}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{s.name}</span>
                    {s.address && <span className="block text-xs text-gray-500">{s.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showMajorField && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">전공</label>
            <input
              type="text"
              placeholder="예: 체육교육과"
              value={newRecord.major}
              onChange={(e) => setNewRecord((prev) => ({ ...prev, major: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">입학년월</label>
            <YearMonthSelect
              value={newRecord.startDate}
              onChange={(startDate) => setNewRecord((prev) => ({ ...prev, startDate }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">졸업년월</label>
            <YearMonthSelect
              value={newRecord.endDate}
              onChange={(endDate) => setNewRecord((prev) => ({ ...prev, endDate }))}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddRecord}
          className="w-full min-h-[44px] px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
        >
          + 학력 추가
        </button>
      </div>

      {/* List -- 졸업년월 기준 자동 정렬(수동 순서 변경 없음) */}
      {records.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">추가된 학력 ({records.length})</h3>
          {sortAcademicRecordsByRecency(records).map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              {editingId === r.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm?.schoolName || ''}
                    onChange={(e) => setEditForm({ ...editForm!, schoolName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    placeholder="예: 서울대학교"
                  />
                  {(r.level === 'graduate' || r.level === 'university') && (
                    <input
                      type="text"
                      value={editForm?.major || ''}
                      onChange={(e) => setEditForm({ ...editForm!, major: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="예: 체육교육과"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditSave(r.id)}
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {LEVEL_LABELS[r.level]}
                        {r.degree && `(${r.degree})`} · {r.schoolName}
                        {r.major && ` ${r.major}`}
                      </p>
                      {(r.startDate || r.endDate) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {r.startDate}
                          {r.startDate && r.endDate ? ' ~ ' : ''}
                          {r.endDate}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditStart(r)}
                          className="min-h-[44px] px-3 py-2 text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap flex items-center justify-center"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id)}
                          className="min-h-[44px] px-3 py-2 text-red-500 hover:text-red-700 font-medium whitespace-nowrap flex items-center justify-center"
                        >
                          삭제
                        </button>
                      </div>
                      <VisibilityToggle
                        visible={r.ownerVisible}
                        onToggle={() => handleToggleVisibility(r.id)}
                        disabled={!profileOwnerVisible}
                        pending={togglingId === r.id}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AcademicSection;
