"use client";

import type { Activity } from "@/lib/damoa/categories";
import { formatActivityPeriod } from "@/lib/activity-period";

export function CareerFields({
  draft,
  onChange,
  inputClass,
}: {
  draft: Activity;
  onChange: (draft: Activity) => void;
  inputClass: string;
}) {
  const current =
    draft.details["재직 상태"] === "재직 중" || /현재\s*$/.test(draft.period);
  const detail = (key: string, value: string) =>
    onChange({ ...draft, details: { ...draft.details, [key]: value } });
  const period = (value: string) => {
    const formatted = formatActivityPeriod(value);
    return current && formatted
      ? `${formatted.split("~")[0].trim()} ~ 현재`
      : formatted;
  };
  return (
    <>
      <label className="block text-sm font-medium text-slate-600">
        회사·기관명 <span className="text-red-500">*</span>
        <input
          autoFocus
          required
          maxLength={150}
          value={draft.details["기관·회사명"] || draft.title}
          onChange={(e) =>
            onChange({
              ...draft,
              title: e.target.value,
              details: { ...draft.details, "기관·회사명": e.target.value },
            })
          }
          placeholder="예: ○○병원, ○○운동센터"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium text-slate-600">
        직무·직책 <span className="text-red-500">*</span>
        <input
          required
          maxLength={1000}
          value={draft.details["직무·직책"] || ""}
          onChange={(e) => detail("직무·직책", e.target.value)}
          placeholder="예: 물리치료사, 트레이너, 팀장"
          className={inputClass}
        />
      </label>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-600">
          재직기간 <span className="text-red-500">*</span>
          <input
            required
            maxLength={100}
            value={draft.period}
            onChange={(e) => onChange({ ...draft, period: e.target.value })}
            onBlur={() => onChange({ ...draft, period: period(draft.period) })}
            placeholder={
              current ? "예: 2026년 3월 ~ 현재" : "예: 2024년 3월 ~ 2026년 4월"
            }
            className={inputClass}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) =>
              onChange({
                ...draft,
                period: e.target.checked
                  ? draft.period.trim()
                    ? `${formatActivityPeriod(draft.period).split("~")[0].trim()} ~ 현재`
                    : ""
                  : draft.period.replace(/\s*~\s*현재\s*$/, ""),
                details: {
                  ...draft.details,
                  "재직 상태": e.target.checked ? "재직 중" : "종료",
                },
              })
            }
            className="h-4 w-4 accent-blue-600"
          />
          현재 재직 중
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-600">
        담당 업무·업무분장
        <textarea
          rows={3}
          maxLength={5000}
          value={draft.description || draft.details["담당 업무"] || ""}
          onChange={(e) =>
            onChange({
              ...draft,
              description: e.target.value,
              details: { ...draft.details, "담당 업무": e.target.value },
            })
          }
          placeholder="담당한 업무와 역할을 적어주세요."
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-600">
          부서 <span className="text-xs font-normal text-slate-400">선택</span>
          <input
            maxLength={1000}
            value={draft.details["부서"] || ""}
            onChange={(e) => detail("부서", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-600">
          근무 형태{" "}
          <span className="text-xs font-normal text-slate-400">선택</span>
          <select
            value={draft.details["근무 형태"] || ""}
            onChange={(e) => detail("근무 형태", e.target.value)}
            className={inputClass}
          >
            <option value="">선택하지 않음</option>
            {["정규직", "계약직", "시간제", "프리랜서", "개인사업", "기타"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
            {draft.details["근무 형태"] &&
              ![
                "정규직",
                "계약직",
                "시간제",
                "프리랜서",
                "개인사업",
                "기타",
              ].includes(draft.details["근무 형태"]) && (
                <option>{draft.details["근무 형태"]}</option>
              )}
          </select>
        </label>
      </div>
      <fieldset className="space-y-4 rounded-xl bg-slate-50 p-4">
        <legend className="text-sm font-medium text-slate-600">
          기관 정보{" "}
          <span className="text-xs font-normal text-slate-400">선택</span>
        </legend>
        <p className="text-xs leading-5 text-slate-500">
          기관의 공식 주소·대표 전화·홈페이지만 입력해주세요.
        </p>
        <label className="block text-sm text-slate-600">
          기관 주소
          <input
            maxLength={1000}
            value={draft.details["근무지 주소"] || ""}
            onChange={(e) => detail("근무지 주소", e.target.value)}
            placeholder="기관의 도로명 주소"
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-600">
          대표 전화
          <input
            type="tel"
            maxLength={30}
            value={draft.details["기관 전화"] || ""}
            onChange={(e) => detail("기관 전화", e.target.value)}
            placeholder="예: 02-1234-5678"
            className={inputClass}
          />
        </label>
        <label className="block text-sm text-slate-600">
          기관 홈페이지
          <input
            type="url"
            maxLength={1000}
            value={draft.details["기관 홈페이지"] || ""}
            onChange={(e) => detail("기관 홈페이지", e.target.value)}
            placeholder="https://"
            className={inputClass}
          />
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={draft.details["주소·지도 공개"] === "공개"}
            onChange={(e) =>
              detail("주소·지도 공개", e.target.checked ? "공개" : "비공개")
            }
            className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
          />
          <span>
            프로필에 기관 주소와 지도 표시
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              기본은 비공개입니다. 현재 근무지로 가져올 때 적용하며, 프로필에서
              다시 선택할 수 있어요. 이미 게시한 프로필은 자동 변경되지
              않습니다.
            </span>
          </span>
        </label>
      </fieldset>
    </>
  );
}
