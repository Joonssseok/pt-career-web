"use client";
import { useState } from "react";

export function AdRevenueEstimator() {
  const [price, setPrice] = useState("50000");
  const [slots, setSlots] = useState("1");
  const [impressions, setImpressions] = useState("10000");
  const [clicks, setClicks] = useState("0");
  const values = [price, slots, impressions, clicks].map((v) =>
    v.trim() === "" ? NaN : Number(v),
  );
  const valid =
    values.every((v) => Number.isSafeInteger(v) && v >= 0) &&
    values[0] <= 100000000 &&
    values[1] <= 2 &&
    values[2] <= 1000000000 &&
    values[3] <= 1000000000 &&
    values[3] <= values[2] &&
    Number.isSafeInteger(values[0] * values[1]);
  const revenue = values[0] * values[1];
  const money = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
  const fields = [
    {
      label: "자리당 월 가격 (원)",
      value: price,
      set: setPrice,
      max: 100000000,
    },
    { label: "판매 자리 수 (0~2)", value: slots, set: setSlots, max: 2 },
    {
      label: "판매 자리 전체 월 노출 (회)",
      value: impressions,
      set: setImpressions,
      max: 1000000000,
    },
    {
      label: "판매 자리 전체 월 클릭 (회)",
      value: clicks,
      set: setClicks,
      max: 1000000000,
    },
  ];
  return (
    <section className="rounded-2xl border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">광고 단가 시뮬레이션</h3>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
          가정값 · 저장되지 않음
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        초기 예시 가격을 넣었습니다. 금액과 예상 실적을 바꿔 비교해보세요. 실제
        계약·입금과는 별개입니다.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.label} className="text-xs font-medium text-slate-600">
            {f.label}
            <input
              type="number"
              min="0"
              max={f.max}
              step="1"
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className="mt-2 block min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900 focus:outline-2 focus:outline-blue-500"
            />
          </label>
        ))}
      </div>
      {!valid && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          0 이상의 정수를 입력하세요. 판매 자리는 최대 2개이며, 클릭 수는 노출
          수를 넘을 수 없습니다.
        </p>
      )}
      <dl className="mt-6 grid gap-4 rounded-xl bg-blue-50/60 p-4 sm:grid-cols-3">
        {[
          {
            label: "예상 월 매출",
            value: valid ? money(revenue) : "계산 불가",
          },
          {
            label: "1,000회 노출당 가격",
            value:
              valid && values[2] > 0
                ? money((revenue / values[2]) * 1000)
                : "계산 불가",
          },
          {
            label: "클릭당 실질 비용",
            value:
              valid && values[3] > 0 ? money(revenue / values[3]) : "계산 불가",
          },
        ].map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-slate-500">{r.label}</dt>
            <dd className="mt-2 text-lg font-bold text-primary">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-6 text-slate-400">
        비용·세금 차감 전 단순 계산입니다. 노출·클릭이 0이면 해당 단가는
        계산하지 않습니다. 가입자 수로 노출량을 대신하지 않습니다.
      </p>
    </section>
  );
}
