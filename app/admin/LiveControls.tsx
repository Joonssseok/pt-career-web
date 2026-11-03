"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCampaign,
  addOperatingEntry,
  setStatisticsExclusion,
} from "@/app/actions/admin-live";
import type { Campaign } from "@/lib/admin-live";
const input =
  "mt-2 block min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900";
const button =
  "min-h-12 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export function BrowserExclusion({
  excluded,
  showDetails = true,
}: {
  excluded: boolean;
  showDetails?: boolean;
}) {
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (excluded) return;
    void setStatisticsExclusion(true)
      .then(() => router.refresh())
      .catch(() => setError("브라우저 제외 설정을 적용하지 못했습니다."));
  }, [excluded, router]);
  if (!showDetails) return null;
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
      <h3 className="font-bold">작업 접속 제외</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        관리자 계정·개발/미리보기 접속은 항상 제외합니다. 이 브라우저도{" "}
        {excluded
          ? "제외 설정이 적용되어 로그아웃 후에도 집계하지 않습니다."
          : "제외 설정을 적용하고 있습니다."}{" "}
        IP는 수집·저장하지 않습니다.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        브라우저 데이터 삭제·다른 브라우저·다른 도메인에서는 관리자 화면에 다시
        접속하면 적용됩니다.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const r = await saveCampaign({
        id: campaign?.id,
        advertiser: d.get("advertiser"),
        title: d.get("title"),
        slot: d.get("slot"),
        image_url: d.get("image_url"),
        target_url: d.get("target_url"),
        starts_on: d.get("starts_on"),
        ends_on: d.get("ends_on"),
        amount: Number(d.get("amount")),
        active: d.get("active") === "on",
      });
      if (!r.ok) {
        setMessage(r.error);
        return;
      }
      setMessage("광고 설정을 저장했습니다.");
      if (!campaign) form.reset();
      router.refresh();
    } catch {
      setMessage("저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        {campaign ? "광고 수정·게재 설정" : "광고 등록"}
      </summary>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {[
            {
              name: "advertiser",
              label: "광고주",
              value: campaign?.advertiser,
              max: 100,
            },
            {
              name: "title",
              label: "광고 제목",
              value: campaign?.title,
              max: 100,
            },
            {
              name: "image_url",
              label: "배너 이미지 HTTPS 주소",
              value: campaign?.image_url,
              max: 2000,
            },
            {
              name: "target_url",
              label: "클릭 이동 HTTPS 주소",
              value: campaign?.target_url,
              max: 2000,
            },
          ].map((f) => (
            <label key={f.name} className="text-xs text-slate-600">
              {f.label}
              <input
                className={input}
                name={f.name}
                defaultValue={f.value}
                maxLength={f.max}
                required
                type={f.name.endsWith("url") ? "url" : "text"}
              />
            </label>
          ))}
          <label className="text-xs text-slate-600">
            자리
            <select
              name="slot"
              defaultValue={campaign?.slot || "left"}
              className={input}
            >
              <option value="left">왼쪽</option>
              <option value="right">오른쪽</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            계약 금액 (원)
            <input
              name="amount"
              type="number"
              min="0"
              max="1000000000"
              step="1"
              defaultValue={campaign?.amount ?? 0}
              required
              className={input}
            />
          </label>
          <label className="text-xs text-slate-600">
            시작일
            <input
              name="starts_on"
              type="date"
              required
              defaultValue={campaign?.starts_on}
              className={input}
            />
          </label>
          <label className="text-xs text-slate-600">
            종료일
            <input
              name="ends_on"
              type="date"
              required
              defaultValue={campaign?.ends_on}
              className={input}
            />
          </label>
          <label className="flex min-h-12 items-center gap-2 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={campaign?.active}
            />
            기간 내 실제 광고 게재
          </label>
        </fieldset>
        <p className="text-xs leading-6 text-slate-500">
          게재를 켜야 공개 화면에 나타납니다. 등록만 하면 기존의 흰색 자리를
          유지합니다. 새 광고는 기본 비노출입니다.
        </p>
        <button disabled={pending} className={button}>
          {pending ? "저장 중…" : "광고 저장"}
        </button>
        <p role="status" className="text-sm text-slate-600">
          {message}
        </p>
      </form>
    </details>
  );
}
export function OperatingEntryForm({
  campaigns,
  backup = false,
}: {
  campaigns: Campaign[];
  backup?: boolean;
}) {
  const [kind, setKind] = useState(backup ? "backup_check" : "payment"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form);
    setPending(true);
    try {
      const r = await addOperatingEntry({
        kind,
        label: d.get("label"),
        amount: kind === "backup_check" ? 0 : Number(d.get("amount")),
        campaign_id: kind === "payment" ? d.get("campaign_id") : null,
        occurred_on: d.get("occurred_on"),
        note: d.get("note"),
      });
      setMessage(r.ok ? "운영 기록을 저장했습니다." : r.error);
      if (r.ok) {
        form.reset();
        router.refresh();
      }
    } catch {
      setMessage("저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        {backup ? "백업 확인 기록 남기기" : "입금·비용 기록"}
      </summary>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {!backup && (
            <label className="text-xs text-slate-600">
              구분
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={input}
              >
                <option value="payment">광고 입금</option>
                <option value="expense">운영 비용</option>
              </select>
            </label>
          )}
          <label className="text-xs text-slate-600">
            {backup ? "확인한 백업 이름·서비스" : "기록 이름"}
            <input name="label" required maxLength={200} className={input} />
          </label>
          {kind === "payment" && (
            <label className="text-xs text-slate-600">
              광고 계약
              <select name="campaign_id" required className={input}>
                <option value="">선택해주세요</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.advertiser} · {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!backup && (
            <label className="text-xs text-slate-600">
              금액 (원)
              <input
                name="amount"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                required
                className={input}
              />
            </label>
          )}
          <label className="text-xs text-slate-600">
            {backup ? "백업 확인일" : "입금·발생일"}
            <input name="occurred_on" type="date" required className={input} />
          </label>
          <label className="text-xs text-slate-600">
            메모·증빙 위치
            <input name="note" maxLength={2000} className={input} />
          </label>
        </fieldset>
        <p className="text-xs leading-6 text-slate-500">
          {backup
            ? "실제로 확인한 백업만 기록하세요. 이 버튼이 백업을 생성하거나 복구하지는 않습니다."
            : "관리자가 확인한 내역을 기록합니다. 은행 입금이나 공급자 청구서를 자동으로 가져오지 않습니다."}{" "}
          기록은 감사 이력과 함께 보관됩니다.
        </p>
        <button disabled={pending} className={button}>
          {pending ? "저장 중…" : "기록 저장"}
        </button>
        <p role="status" className="text-sm text-slate-600">
          {message}
        </p>
      </form>
    </details>
  );
}
