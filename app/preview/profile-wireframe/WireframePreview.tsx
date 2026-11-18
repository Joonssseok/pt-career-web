"use client";

import { useEffect, useRef, useState } from "react";
import FreeLayout, { type LayoutBox } from "./FreeLayout";
import { layoutStorageKey, parseSavedLayout, type SavedLayout } from "./storage";
import styles from "./wireframe.module.css";

const versions = [
  { id: "balanced", name: "A · 균형형", note: "상단에 인물, 아래에 콘텐츠를 두 열로 배치" },
  { id: "rail", name: "B · 프로필 분리형", note: "왼쪽에 인물과 이력, 오른쪽에 콘텐츠를 모아 배치" },
  { id: "editorial", name: "C · 대표 콘텐츠형", note: "대표 콘텐츠를 넓게, 나머지는 가로 묶음으로 배치" },
  { id: "mosaic", name: "D · 모듈 조합형", note: "인물·대표 콘텐츠를 나란히, 글·사진·이력을 서로 다른 비율로 배치" },
] as const;

const areas = [
  ["photo", "프로필 사진"], ["identity", "이름 · 직군 · 기본 정보"],
  ["summary", "경력 · 인증 경력 · 지역 요약"], ["intro", "소개 · 전문 분야"],
  ["feature", "대표 콘텐츠"], ["video", "영상"], ["column", "칼럼"],
  ["photos", "활동 사진"], ["activity", "활동 기록"],
  ["resume", "전체 이력"], ["workplace", "근무지 · 지도"],
] as const;

export default function WireframePreview() {
  const [version, setVersion] = useState<(typeof versions)[number]>(versions[0]);
  const [mobile, setMobile] = useState(false);
  const [compare, setCompare] = useState(true);
  const [layout, setLayout] = useState<LayoutBox[] | null>(null);
  const [centerline, setCenterline] = useState(true);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  function loadSaved() {
    try {
      const raw = localStorage.getItem(layoutStorageKey);
      const saved = parseSavedLayout(raw);
      if (!saved) { if (raw) setNotice("저장된 배치를 읽을 수 없습니다. 기존 저장 내용은 유지했습니다."); return; }
      setVersion(versions.find((item) => item.id === saved.versionId)!);
      setMobile(saved.mobile); setCompare(false); setCenterline(saved.centerline);
      setLayout(saved.boxes); setRevision((value) => value + 1); setRestored(true);
      setNotice("저장한 배치를 불러왔습니다.");
    } catch { setNotice("브라우저 저장소를 사용할 수 없습니다. 저장 허용 설정을 확인해주세요."); }
  }
  useEffect(() => { loadSaved(); }, []);
  function saveLayout(boxes: LayoutBox[], showCenterline: boolean) {
    const saved: SavedLayout = { schema: 1, versionId: version.id, mobile, centerline: showCenterline, boxes };
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(saved));
      setNotice("이 브라우저에 배치를 저장했습니다. 새로고침해도 다시 열립니다.");
      return true;
    } catch { setNotice("저장하지 못했습니다. 현재 편집 내용은 화면에 남아 있습니다."); return false; }
  }
  function beginEditing() {
    const root = canvas.current;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    setCenterline(true); setRestored(false); setNotice("");
    setLayout(areas.map(([id, label]) => {
      const element = root.querySelector(`[data-area="${id}"]`)!;
      const rect = element.getBoundingClientRect();
      return { id, label, x: (rect.left - bounds.left) / bounds.width * 100, y: rect.top - bounds.top, w: rect.width / bounds.width * 100, h: rect.height };
    }));
  }
  return (
    <main className={styles.page}>
      <header className={styles.controls}>
        <div className={styles.heading}><h1>프로필 배치 비교</h1><span>와이어프레임 · 미배포</span></div>
        <div className={styles.options} aria-label="배치 선택">
          {versions.map((item) => <button key={item.id} aria-pressed={!compare && item.id === version.id} onClick={() => { setVersion(item); setCompare(false); setLayout(null); }}>{item.name}</button>)}
          <button aria-pressed={compare} onClick={() => { setCompare(!compare); setLayout(null); }}>한눈에 비교</button>
          {!compare && <button aria-pressed={!!layout} onClick={() => layout ? setLayout(null) : beginEditing()}>{layout ? "배치 편집 닫기" : "직접 배치"}</button>}
          <button onClick={loadSaved}>저장한 배치 불러오기</button>
        </div>
        <p className={styles.storageNote}>‘배치 저장’을 누른 상태가 이 브라우저에 유지됩니다. 다른 배치를 저장하면 이전 저장을 덮어씁니다.</p>
        {notice && <p className={styles.storageNote} role="status">{notice}</p>}
        <div className={styles.bottom}><p>{compare ? "같은 영역을 네 가지 배치로 비교합니다." : version.note}</p>
          <div className={styles.options} aria-label="화면 크기"><button aria-pressed={!mobile} onClick={() => { setMobile(false); setLayout(null); }}>PC</button><button aria-pressed={mobile} onClick={() => { setMobile(true); setLayout(null); }}>모바일</button></div>
        </div>
      </header>
      <div className={`${compare ? styles.comparison : styles.single} ${mobile ? styles.mobile : ""}`}>
        {(compare ? versions : [version]).map((item) => <section className={styles.sheet} key={item.id} aria-label={item.name}>
          {compare && <h2>{item.name}</h2>}
          {layout && !compare ? <FreeLayout key={revision} initial={layout} initialCenterline={centerline} initiallySaved={restored} onSave={saveLayout} /> : <div ref={!compare ? canvas : undefined} className={`${styles.canvas} ${styles[item.id]}`}>
            {areas.map(([id, label]) => <div key={id} data-area={id} className={`${styles.block} ${styles[id]}`}><span>{label}</span></div>)}
          </div>}
        </section>)}
      </div>
    </main>
  );
}
