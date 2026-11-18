"use client";

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import styles from "./wireframe.module.css";

export type LayoutBox = { id: string; label: string; x: number; y: number; w: number; h: number };
type Mode = "move" | "resize";

export function adjustBox(box: LayoutBox, dx: number, dy: number, mode: Mode): LayoutBox {
  const snap = (value: number, step: number) => Math.round(value / step) * step;
  if (mode === "move") return { ...box, x: Math.max(0, Math.min(100 - box.w, snap(box.x + dx, 1))), y: Math.max(0, Math.min(2400, snap(box.y + dy, 8))) };
  return { ...box, w: Math.max(8, Math.min(100 - box.x, snap(box.w + dx, 1))), h: Math.max(48, Math.min(1200, snap(box.h + dy, 8))) };
}

export default function FreeLayout({ initial, initialCenterline = true, initiallySaved = false, onSave }: { initial: LayoutBox[]; initialCenterline?: boolean; initiallySaved?: boolean; onSave?: (boxes: LayoutBox[], centerline: boolean) => boolean }) {
  const [boxes, setBoxes] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [centerline, setCenterline] = useState(initialCenterline);
  const [savedSignature, setSavedSignature] = useState(initiallySaved ? JSON.stringify({ boxes: initial, centerline: initialCenterline }) : "");
  const nextId = useRef(Math.max(0, ...initial.map((box) => /^custom-(\d+)$/.test(box.id) ? Number(box.id.slice(7)) : 0)) + 1);
  const board = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ box: LayoutBox; mode: Mode; x: number; y: number; width: number } | null>(null);
  const undo = useRef<LayoutBox[][]>([]);
  useEffect(() => {
    if (editing) board.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [editing]);
  function rename(box: LayoutBox) { setLabel(box.label); setEditing(box.id); }
  function saveLabel() {
    if (!editing) return;
    const value = label.trim();
    if (value && boxes.find((box) => box.id === editing)?.label !== value) {
      undo.current.push(boxes);
      setBoxes((items) => items.map((box) => box.id === editing ? { ...box, label: value } : box));
    }
    setEditing(null);
  }
  function addBox() {
    const box = { id: `custom-${nextId.current++}`, label: "새 영역", x: 0, y: Math.max(0, ...boxes.map((item) => item.y + item.h)) + 16, w: 48, h: 144 };
    undo.current.push(boxes); setBoxes((items) => [...items, box]); rename(box);
  }
  function removeBox(id: string) {
    undo.current.push(boxes);
    if (editing === id) setEditing(null);
    setBoxes((items) => items.filter((box) => box.id !== id));
  }
  function save() {
    const current = boxes.map((box) => box.id === editing && label.trim() ? { ...box, label: label.trim() } : box);
    if (editing) { undo.current.push(boxes); setBoxes(current); setEditing(null); }
    if (onSave?.(current, centerline)) setSavedSignature(JSON.stringify({ boxes: current, centerline }));
  }
  function replace(box: LayoutBox) { setBoxes((items) => items.map((item) => item.id === box.id ? box : item)); }
  function start(event: PointerEvent<HTMLButtonElement>, box: LayoutBox, mode: Mode) {
    if (event.button !== 0) return;
    event.preventDefault();
    undo.current.push(boxes.map((item) => ({ ...item })));
    gesture.current = { box, mode, x: event.clientX, y: event.clientY, width: board.current?.getBoundingClientRect().width || 1 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current) return;
    replace(adjustBox(current.box, (event.clientX - current.x) / current.width * 100, event.clientY - current.y, current.mode));
  }
  function finish(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    if (cancel && gesture.current) { replace(gesture.current.box); undo.current.pop(); }
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, box: LayoutBox, mode: Mode) {
    if (event.key === "F2") { event.preventDefault(); rename(box); return; }
    const keys: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] };
    const delta = keys[event.key];
    if (!delta) return;
    event.preventDefault(); undo.current.push(boxes.map((item) => ({ ...item })));
    replace(adjustBox(box, delta[0], delta[1], mode));
  }
  return <>
    <div className={styles.editTools}><p>끌어서 이동 · 모서리로 크기 조절 · 글씨를 두 번 눌러 이름 수정<br />방향키로 조절 · F2로 이름 수정 · Enter로 적용 · Esc로 취소<br />실제 프로필에는 반영되지 않습니다. {savedSignature === JSON.stringify({ boxes, centerline }) && !editing ? "저장된 상태입니다." : "저장하지 않은 변경이 있습니다."}</p>
      <div className={styles.options}>{onSave && <button onClick={save}>배치 저장</button>}<button onClick={addBox}>새 칸 추가</button><button aria-pressed={centerline} onClick={() => setCenterline(!centerline)}>중앙선</button><button onClick={() => { setEditing(null); const previous = undo.current.pop(); if (previous) setBoxes(previous); }}>되돌리기</button><button onClick={() => { setEditing(null); undo.current.push(boxes); setBoxes(initial); }}>처음 배치로</button></div>
    </div>
    <div ref={board} className={styles.freeBoard} style={{ height: Math.max(600, ...boxes.map((box) => box.y + box.h + 96)) }}>
      {centerline && <div className={styles.centerline} aria-hidden="true" />}
      {boxes.map((box) => <div key={box.id} className={styles.freeBox} data-layout={box.id} style={{ left: `${box.x}%`, top: box.y, width: `${box.w}%`, height: box.h }}>
        <button className={styles.moveHandle} aria-label={`${box.label} 이동`} onDoubleClick={() => rename(box)} onPointerDown={(event) => start(event, box, "move")} onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => finish(event, true)} onKeyDown={(event) => keyboard(event, box, "move")}>{box.label}</button>
        {editing === box.id && <input className={styles.labelInput} aria-label="영역 이름" value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} onBlur={saveLabel} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); saveLabel(); } if (event.key === "Escape") { event.preventDefault(); setEditing(null); } }} />}
        <button className={styles.resizeHandle} aria-label={`${box.label} 크기 조절`} onPointerDown={(event) => start(event, box, "resize")} onPointerMove={move} onPointerUp={finish} onPointerCancel={(event) => finish(event, true)} onKeyDown={(event) => keyboard(event, box, "resize")} />
        <button className={styles.deleteHandle} aria-label={`${box.label} 칸 삭제`} title="칸 삭제" onClick={() => removeBox(box.id)}>×</button>
      </div>)}
    </div>
  </>;
}
