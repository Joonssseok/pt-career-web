"use client";

import { useRef, useState } from "react";
import ProfessionSection from "@/components/profile-sections/ProfessionSection";
import SpecialtySection from "@/components/profile-sections/SpecialtySection";
import type { SectionSaveHandle } from "@/components/profile-sections/types";
import { SpecialtyDirectory } from "@/components/specialties/SpecialtyDirectory";
import { SPECIALTY_CATALOG } from "@/lib/specialties/catalog";
import { ExpertFilters } from "@/app/experts/ExpertFilters";
import styles from "./preview.module.css";

const professions = [
  { id: "preview-medical", slug: "physical-therapist", name: "물리치료사", sort_order: 1, is_medical_technician: true },
  { id: "preview-trainer", slug: "personal-trainer", name: "퍼스널 트레이너", sort_order: 2, is_medical_technician: false },
];
const professionData = { professions, selected: [{ professionId: "preview-medical", customLabel: null, ownerVisible: true }] };
const specialties = SPECIALTY_CATALOG.map((row, index) => ({ ...row, id: row.slug, sort_order: index + 1 }));
const specialtyData = { specialties, selected: [] };

export function SpecialtyCategoriesPreview() {
  const [medical, setMedical] = useState(false);
  const [message, setMessage] = useState("");
  const selection = useRef<SectionSaveHandle>(null);
  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>전문분야 개편 · 로컬 미리보기</p>
        <h1>운동 분야 10개와 병원 근무</h1>
        <p>이 화면의 선택은 실제 프로필에 저장되지 않습니다.</p>
        <nav aria-label="미리보기 영역"><a href="#category-home">홈 목록</a><a href="#category-editor">프로필 작성</a><a href="#category-filter">탐색 필터</a></nav>
      </header>
      <section id="category-home" className={styles.section}>
        <h2>원하는 분야에서 시작하세요.</h2>
        <SpecialtyDirectory options={specialties} />
      </section>
      <section id="category-editor" className={`${styles.section} ${styles.editor}`}>
        <h2>프로필 작성</h2>
        <p>직군 선택에 따라 병원 근무 항목이 바뀝니다.</p>
        <h3>직군</h3>
        <ProfessionSection previewData={professionData} onMedicalTechnicianChange={setMedical} />
        <h3>전문분야 · 1~3개 선택</h3>
        <SpecialtySection ref={selection} previewData={specialtyData} medicalTechnician={medical} />
        <button type="button" className={styles.check} onClick={() => {
          const result = selection.current?.validate?.();
          setMessage(result?.ok ? "선택 조건을 충족했습니다. 실제 저장은 하지 않았습니다." : result?.error || "선택 내용을 확인해주세요.");
        }}>선택 확인</button>
        <p role="status">{message}</p>
      </section>
      <section id="category-filter" className={styles.section}>
        <h2>탐색 필터</h2>
        <ExpertFilters specialties={specialties} professions={professions} preview />
      </section>
    </main>
  );
}
