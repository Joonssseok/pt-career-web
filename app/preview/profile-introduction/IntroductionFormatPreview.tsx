"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  introductionFromText,
  validateIntroductionDocument,
} from "@/lib/profile-versions/introduction-format";
import { IntroductionContent } from "@/components/profile-editor/IntroductionContent";
import styles from "./preview.module.css";
const IntroductionEditor = dynamic(
  () =>
    import("@/components/profile-editor/IntroductionEditor").then(
      (module) => module.IntroductionEditor,
    ),
  { ssr: false, loading: () => <p>글쓰기 도구를 불러오고 있어요…</p> },
);

export function IntroductionFormatPreview({
  initialText,
  name,
}: {
  initialText: string;
  name: string;
}) {
  const [document, setDocument] = useState(() =>
    introductionFromText(initialText),
  );
  const checked = validateIntroductionDocument(document);
  return (
    <main className={styles.page}>
      <header>
        <p>Tiptap 공식 Simple Editor · 미리보기</p>
        <h1>소개를 자유롭게 꾸며보세요</h1>
        <p>
          기존 소개를 불러왔어요. 이 화면에서 바꾼 내용은 서버에 저장되지
          않습니다.
        </p>
      </header>
      <div className={styles.columns}>
        <section aria-label="소개 편집">
          <h2>소개</h2>
          <p className={styles.help}>
            꾸밀 글자를 선택한 뒤 도구를 눌러주세요.
          </p>
          <IntroductionEditor document={document} onChange={setDocument} />
          <p role="alert">{checked.ok ? "" : checked.error}</p>
        </section>
        <section className={styles.preview} aria-label="서식 적용 미리보기">
          <p className={styles.eyebrow}>미리보기{name ? ` · ${name}` : ""}</p>
          <IntroductionContent document={document} fallback={initialText} />
        </section>
      </div>
    </main>
  );
}
