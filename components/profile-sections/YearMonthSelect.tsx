'use client';

import { useEffect, useState } from 'react';

const CURRENT_YEAR = new Date().getFullYear();
// 최신 연도가 먼저 오도록 내림차순 (현재 연도 ~ 현재 연도-50) — 경력/교육
// 입력은 최근 연도를 고르는 경우가 훨씬 많다.
const YEARS = Array.from({ length: 51 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

type Props = {
  // 기존 저장 로직이 그대로 기대하는 "YYYY-MM" 문자열(또는 빈 문자열).
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

// 네이티브 <input type="month">을 연도/월 두 개의 <select>로 대체한다.
// 연도만 고르고 월을 아직 안 고른 중간 상태를 표현해야 해서 로컬 state로
// 두 값을 따로 들고 있다가, 둘 다 채워졌을 때만 부모에 "YYYY-MM"을 전달한다
// (부모 state는 지금처럼 하나의 문자열만 다루면 되고, 저장/RPC 쪽은 손댈 게 없다).
export function YearMonthSelect({ value, onChange, disabled = false }: Props) {
  const [year, setYear] = useState(() => value.split('-')[0] ?? '');
  const [month, setMonth] = useState(() => value.split('-')[1] ?? '');

  useEffect(() => {
    const [y = '', m = ''] = value ? value.split('-') : ['', ''];
    setYear(y);
    setMonth(m);
  }, [value]);

  const emit = (nextYear: string, nextMonth: string) => {
    onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : '');
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          emit(e.target.value, month);
        }}
        disabled={disabled}
        className="bg-white text-gray-900 placeholder:text-gray-400 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="">연도</option>
        {YEARS.map((y) => (
          <option key={y} value={String(y)}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          emit(year, e.target.value);
        }}
        disabled={disabled}
        className="bg-white text-gray-900 placeholder:text-gray-400 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="">월</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {Number(m)}월
          </option>
        ))}
      </select>
    </div>
  );
}
