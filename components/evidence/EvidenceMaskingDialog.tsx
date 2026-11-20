"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ReviewFile } from "@/lib/profile-versions/review-preview";
import {
  containsWord,
  overlapsWord,
  encodeMaskedCopy,
  loadEvidenceCanvas,
  normalizedRect,
  paintMaskedCopy,
  type MaskRect,
  type MaskWord,
} from "@/lib/evidence-masking";
import styles from "./EvidenceMaskingDialog.module.css";
import { Gowun_Dodum } from "next/font/google";
const displayFont = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--masking-gowun",
});
export type MaskedEvidenceCopy = { sourceId: string; file: File };
export function EvidenceMaskingDialog({
  files,
  ownName,
  onComplete,
  onCancel,
  initialPublicIds = [],
}: {
  files: ReviewFile[];
  ownName: string;
  initialPublicIds?: string[];
  onComplete: (copies: MaskedEvidenceCopy[], publicSourceIds: string[]) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    guide = useRef<HTMLDetailsElement>(null);
  const [index, setIndex] = useState(0),
    [source, setSource] = useState<HTMLCanvasElement | null>(null),
    [rects, setRects] = useState<MaskRect[]>([]),
    [history, setHistory] = useState<MaskRect[][]>([]),
    [words, setWords] = useState<MaskWord[]>([]);
  const [mode, setMode] = useState<"draw" | "adjust" | "select" | "pan">(
      "draw",
    ),
    [zoom, setZoom] = useState(1),
    [ghost, setGhost] = useState<MaskRect | null>(null),
    [step, setStep] = useState<"mask" | "confirm">("mask");
  const [checked, setChecked] = useState(false),
    [isPublic, setIsPublic] = useState(false),
    [preview, setPreview] = useState(""),
    [error, setError] = useState(""),
    [ocrStatus, setOcrStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [copies, setCopies] = useState<MaskedEvidenceCopy[]>([]),
    [publicIds, setPublicIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const adjustment = useRef<{
    index: number;
    operation: "move" | "resize";
    origin: { x: number; y: number };
    before: MaskRect[];
  } | null>(null);
  const copy = useRef<File | null>(null),
    drag = useRef<{
      x: number;
      y: number;
      clientX: number;
      clientY: number;
      left: number;
      top: number;
    } | null>(null);
  const current = files[index];
  useEffect(() => {
    if (window.matchMedia?.("(max-width:899px)").matches && guide.current)
      guide.current.open = false;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setSource(null);
    setRects([]);
    setHistory([]);
    setWords([]);
    setPreview("");
    setStep("mask");
    setChecked(false);
    setZoom(1);
    setMode("draw");
    setSelected(null);
    setError("");
    setIsPublic(initialPublicIds.includes(current.id));
    setOcrStatus("사진을 불러오는 중…");
    void loadEvidenceCanvas(current, controller.signal)
      .then(async (image) => {
        if (!active) return;
        setSource(image);
        setOcrStatus(
          "기기 안에서 글자를 찾고 있어요. 기다리지 않고 끌어서 가릴 수 있어요.",
        );
        try {
          const { recognizeEvidence } = await import("@/lib/evidence-ocr");
          const found = await recognizeEvidence(
            image,
            ownName,
            controller.signal,
          );
          if (!active) return;
          setWords(found);
          setChecked(false);
          setOcrStatus(
            found.length
              ? "사진 위를 끌어서 가려 주세요. 노란 테두리는 개인정보 의심 영역입니다."
              : "글자를 찾지 못했어요. 끌어서 가려 주세요.",
          );
        } catch {
          if (active) setOcrStatus("글자를 찾지 못했어요. 끌어서 가려 주세요.");
        }
      })
      .catch(() => {
        if (active) {
          setError(
            "사진을 열지 못했습니다. JPG·PNG·WebP 사진인지 확인하고 다시 선택해주세요. PDF는 보낼 수 없어요.",
          );
          setOcrStatus("");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
    // A file is an immutable input for this masking session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);
  useEffect(() => {
    if (!source || !canvas.current) return;
    const target = canvas.current;
    target.width = source.width;
    target.height = source.height;
    target.getContext("2d")?.drawImage(paintMaskedCopy(source, rects), 0, 0);
  }, [source, rects, step]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function change(next: MaskRect[]) {
    setHistory((previous) => [...previous.slice(-49), rects]);
    setRects(next);
    setChecked(false);
    setSelected(null);
  }
  const sensitive = words.filter((w) => w.sensitive && !containsWord(rects, w));
  const required = words.filter((w) => w.required && overlapsWord(rects, w));
  function point(e: PointerEvent<HTMLDivElement>) {
    const bounds = stage.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height)),
    };
  }
  function start(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !source || busy || mode === "select") return;
    if (mode === "adjust") {
      setSelected(null);
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      ...point(e),
      clientX: e.clientX,
      clientY: e.clientY,
      left: viewport.current?.scrollLeft ?? 0,
      top: viewport.current?.scrollTop ?? 0,
    };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const editing = adjustment.current;
    if (editing) {
      const p = point(e),
        original = editing.before[editing.index];
      const dx = p.x - editing.origin.x,
        dy = p.y - editing.origin.y;
      const next =
        editing.operation === "move"
          ? {
              ...original,
              x: Math.max(0, Math.min(1 - original.width, original.x + dx)),
              y: Math.max(0, Math.min(1 - original.height, original.y + dy)),
            }
          : {
              ...original,
              width: Math.min(
                1 - original.x,
                Math.max(0.01, original.width + dx),
              ),
              height: Math.min(
                1 - original.y,
                Math.max(0.01, original.height + dy),
              ),
            };
      setRects(editing.before.map((r, i) => (i === editing.index ? next : r)));
      return;
    }
    const a = drag.current;
    if (!a) return;
    if (mode === "pan" && viewport.current) {
      viewport.current.scrollLeft = a.left + a.clientX - e.clientX;
      viewport.current.scrollTop = a.top + a.clientY - e.clientY;
    } else setGhost(normalizedRect(a, point(e)));
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    if (adjustment.current) {
      move(e);
      adjustment.current = null;
      return;
    }
    const a = drag.current;
    drag.current = null;
    setGhost(null);
    if (!a || mode === "pan") return;
    const r = normalizedRect(a, point(e));
    if (r.width * source!.width >= 3 && r.height * source!.height >= 3)
      change([...rects, r]);
  }
  function adjust(
    e: PointerEvent<HTMLElement>,
    index: number,
    operation: "move" | "resize",
  ) {
    if (e.button !== 0 || mode !== "adjust") return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(index);
    stage.current!.setPointerCapture(e.pointerId);
    const bounds = stage.current!.getBoundingClientRect();
    adjustment.current = {
      index,
      operation,
      before: rects,
      origin: {
        x: (e.clientX - bounds.left) / bounds.width,
        y: (e.clientY - bounds.top) / bounds.height,
      },
    };
    setHistory((previous) => [...previous.slice(-49), rects]);
    setChecked(false);
  }
  async function confirm() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      copy.current = await encodeMaskedCopy(source, rects);
      setPreview(URL.createObjectURL(copy.current));
      setChecked(false);
      setStep("confirm");
    } catch {
      setError(
        "사본을 만들지 못했습니다. 10MB 이하의 더 작은 사진으로 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  function complete() {
    if (!checked || !copy.current) return;
    const next = [...copies, { sourceId: current.id, file: copy.current }],
      nextPublic = isPublic ? [...publicIds, current.id] : publicIds;
    if (index + 1 < files.length) {
      setCopies(next);
      setPublicIds(nextPublic);
      setIndex(index + 1);
    } else onComplete(next, nextPublic);
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="masking-title"
      className={`${displayFont.variable} ${styles.dialog}`}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <header className={styles.header}>
        <strong>
          PT <span>Career</span>
        </strong>
        <button type="button" onClick={onCancel}>
          가리기 닫기
        </button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.side}>
          <p>
            심사 요청 전에 · 자료 {index + 1}/{files.length}
          </p>
          <h2>개인정보를 가리고 보내요</h2>
          <ol>
            <li>1 자료 고르기</li>
            <li aria-current={step === "mask" ? "step" : undefined}>
              2 개인정보 가리기
            </li>
            <li aria-current={step === "confirm" ? "step" : undefined}>
              3 가린 사본 확인
            </li>
          </ol>
          <details ref={guide} open>
            <summary>가릴 곳·남길 곳 안내</summary>
            <h3>꼭 가려 주세요</h3>
            <p>
              주민등록번호 뒷자리, 집 주소, 전화번호·이메일, 얼굴 사진, 다른
              사람 이름
            </p>
            <h3>남겨 주세요</h3>
            <p>내 이름, 자격·면허 이름과 번호, 발급 기관, 발급일</p>
          </details>
          <p className={styles.note}>
            다모아 원본은 수정하지 않습니다. 심사에는 새로 만든 사진 사본만
            연결합니다.
          </p>
        </aside>
        <main className={styles.main}>
          <h1 id="masking-title">
            {step === "mask" ? "개인정보 가리기" : "가린 사본을 확인해주세요"}
          </h1>
          <p>PDF는 보낼 수 없어요. 사진(JPG·PNG·WebP)으로 올려 주세요.</p>
          {error && (
            <p role="alert" className={styles.warning}>
              {error}
            </p>
          )}
          {step === "mask" ? (
            <section className={styles.sheet}>
              <div
                className={sensitive.length ? styles.found : styles.info}
                role="status"
              >
                {sensitive.length
                  ? `개인정보로 보이는 곳 ${sensitive.length}군데를 찾았어요.`
                  : words.some((w) => w.sensitive)
                    ? "찾은 곳을 모두 가렸어요. 전체를 직접 확인해주세요."
                    : ocrStatus}
                {sensitive.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      change([
                        ...rects,
                        ...sensitive.map(({ x, y, width, height }) => ({
                          x,
                          y,
                          width,
                          height,
                        })),
                      ])
                    }
                  >
                    모두 가리기
                  </button>
                )}
              </div>
              <div className={styles.tools}>
                <button
                  type="button"
                  aria-pressed={mode === "draw"}
                  onClick={() => setMode("draw")}
                >
                  직접 그리기
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "adjust"}
                  onClick={() => setMode("adjust")}
                >
                  네모 조절
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "select"}
                  onClick={() => setMode("select")}
                >
                  인식 영역 선택
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "pan"}
                  onClick={() => setMode("pan")}
                >
                  화면 옮기기
                </button>
                <button
                  type="button"
                  disabled={zoom <= 1}
                  aria-label="사진 축소"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                >
                  −
                </button>
                <output>{Math.round(zoom * 100)}%</output>
                <button
                  type="button"
                  disabled={zoom >= 3}
                  aria-label="사진 확대"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  ＋
                </button>
                <span>가린 곳 {rects.length}개</span>
                <button
                  type="button"
                  disabled={!history.length}
                  onClick={() => {
                    setRects(history[history.length - 1]);
                    setHistory(history.slice(0, -1));
                    setSelected(null);
                    setChecked(false);
                  }}
                >
                  되돌리기
                </button>
                <button
                  type="button"
                  disabled={!rects.length}
                  onClick={() => change([])}
                >
                  모두 지우기
                </button>
                <button
                  type="button"
                  disabled={!source}
                  onClick={() =>
                    change([
                      ...rects,
                      { x: 0.4, y: 0.4, width: 0.2, height: 0.08 },
                    ])
                  }
                >
                  중앙 네모 추가
                </button>
                {selected !== null && rects[selected] && (
                  <button
                    type="button"
                    onClick={() =>
                      change(rects.filter((_, i) => i !== selected))
                    }
                  >
                    선택한 네모 삭제
                  </button>
                )}
              </div>
              <div
                ref={viewport}
                className={styles.viewport}
                aria-label="가릴 사진 영역"
              >
                <div
                  ref={stage}
                  className={styles.stage}
                  aria-label="사진 위 편집 영역"
                  data-mode={mode}
                  style={{ width: `${zoom * 100}%` }}
                  onPointerDown={start}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={() => {
                    if (adjustment.current) setRects(adjustment.current.before);
                    adjustment.current = null;
                    drag.current = null;
                    setGhost(null);
                  }}
                >
                  <canvas ref={canvas} aria-label="개인정보 가리기 사진" />
                  {source &&
                    words
                      .filter((w) => w.sensitive && !containsWord(rects, w))
                      .map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          className={styles.sensitive}
                          tabIndex={mode === "select" ? 0 : -1}
                          style={{
                            left: `${w.x * 100}%`,
                            top: `${w.y * 100}%`,
                            width: `${w.width * 100}%`,
                            height: `${w.height * 100}%`,
                          }}
                          aria-label={`${w.text} 가리기`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            change([
                              ...rects,
                              {
                                x: w.x,
                                y: w.y,
                                width: w.width,
                                height: w.height,
                              },
                            ])
                          }
                        />
                      ))}
                  {rects.map((r, i) => (
                    <div key={i}>
                      <button
                        type="button"
                        className={styles.mask}
                        aria-label={`가린 영역 ${i + 1} 이동`}
                        aria-pressed={selected === i}
                        tabIndex={mode === "adjust" ? 0 : -1}
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                          width: `${r.width * 100}%`,
                          height: `${r.height * 100}%`,
                        }}
                        onPointerDown={(e) => adjust(e, i, "move")}
                        onClick={() => setSelected(i)}
                      />
                      {mode === "adjust" && (
                        <button
                          type="button"
                          className={styles.resize}
                          aria-label={`가린 영역 ${i + 1} 크기 조절`}
                          style={{
                            left: `${(r.x + r.width) * 100}%`,
                            top: `${(r.y + r.height) * 100}%`,
                          }}
                          onPointerDown={(e) => adjust(e, i, "resize")}
                        />
                      )}
                    </div>
                  ))}
                  {ghost && (
                    <div
                      className={styles.ghost}
                      style={{
                        left: `${ghost.x * 100}%`,
                        top: `${ghost.y * 100}%`,
                        width: `${ghost.width * 100}%`,
                        height: `${ghost.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <p>
                {mode === "draw"
                  ? "사진 어디서든 끌어서 네모를 그리세요. 노란 테두리 위에서도 그릴 수 있어요."
                  : mode === "adjust"
                    ? "검은 네모를 끌어서 옮기고, 오른쪽 아래 손잡이로 크기를 조절하세요. 네모를 선택하면 삭제할 수 있어요."
                    : mode === "select"
                      ? "노란 개인정보 의심 영역을 누르면 그 부분만 가려집니다."
                      : "사진을 끌어서 화면을 옮기세요."}{" "}
                글자 인식은 빠뜨릴 수 있으니 마지막에 전체를 확인해주세요.
              </p>
            </section>
          ) : (
            <section className={styles.sheet}>
              <div className={styles.result}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="실제로 제출할 가린 사본" />
              </div>
              {sensitive.length > 0 && (
                <p className={styles.warning}>
                  개인정보로 보이는 곳이 남아 있어요. 이대로 보내면 심사에서
                  돌려보낼 수 있습니다. 현재는 반려되어도 제출한 사본이 자동
                  삭제되지 않습니다.
                </p>
              )}
              {required.length > 0 && (
                <p className={styles.warning}>
                  이름·자격 등 심사에 필요한 글자가 가려졌을 수 있어요. 확인하지
                  못하면 반려될 수 있습니다.
                </p>
              )}
              <fieldset className={styles.disclosure}>
                <legend>사본 공개 방식</legend>
                <label>
                  <input
                    type="radio"
                    name="mask-disclosure"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                  />
                  보여 주지 않기 · 인증배지만 표시
                </label>
                <label>
                  <input
                    type="radio"
                    name="mask-disclosure"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                  />
                  승인되면 프로필에 가린 사본 보여 주기
                </label>
              </fieldset>
              <label className={styles.confirm}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />
                개인정보를 가린 것을 직접 확인했어요.
              </label>
              <p>
                지금은 사본을 첨부 목록에 반영합니다. 프로필 게시 시 함께 심사
                요청됩니다.
              </p>
            </section>
          )}
        </main>
      </div>
      <footer className={styles.footer}>
        <span>가리기 위치와 인식한 글자는 서버에 저장하지 않습니다.</span>
        <div>
          <button
            type="button"
            onClick={
              step === "mask"
                ? onCancel
                : () => {
                    setStep("mask");
                    setChecked(false);
                  }
            }
          >
            {step === "mask" ? "취소" : "다시 가리기"}
          </button>
          {step === "mask" ? (
            <button
              type="button"
              className={styles.primary}
              disabled={!source || busy}
              onClick={() => void confirm()}
            >
              {busy ? "사본 만드는 중…" : "가린 사본 확인"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={!checked}
              onClick={complete}
            >
              {index + 1 < files.length ? "다음 자료 가리기" : "가린 사본 반영"}
            </button>
          )}
        </div>
      </footer>
    </dialog>
  );
}
