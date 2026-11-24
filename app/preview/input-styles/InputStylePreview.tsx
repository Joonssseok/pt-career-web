"use client";

import { useId, useState } from "react";
import styles from "./preview.module.css";

const directions = [
  {
    id: "outline",
    letter: "A",
    name: "얇은 테두리",
    description: "작은 모서리와 가는 선으로 단정하게.",
    note: "기존 화면과 가장 자연스럽게 이어집니다.",
    recommended: true,
  },
  {
    id: "underline",
    letter: "B",
    name: "밑줄만",
    description: "박스를 덜어내고 글과 여백을 중심으로.",
    note: "입력 영역이 길어도 가볍게 보입니다.",
  },
  {
    id: "grouped",
    letter: "C",
    name: "묶음 행",
    description: "설정 목록처럼 한 덩어리로 정리.",
    note: "항목이 많을 때 가장 정돈되어 보입니다.",
  },
  {
    id: "filled",
    letter: "D",
    name: "은은한 배경",
    description: "테두리 대신 옅은 배경으로 구분.",
    note: "입력할 곳이 부드럽고 분명하게 보입니다.",
  },
] as const;
type Direction = (typeof directions)[number];
const fields = [
  {
    key: "inquiry",
    label: "문의 링크",
    placeholder: "https://pf.kakao.com/…",
    type: "url",
  },
  {
    key: "phone",
    label: "공개 전화번호",
    placeholder: "전화번호 입력",
    type: "tel",
  },
  {
    key: "email",
    label: "공개 이메일",
    placeholder: "업무용 이메일 입력",
    type: "email",
  },
  {
    key: "address",
    label: "방문 주소",
    placeholder: "근무지 주소 입력",
    type: "text",
  },
] as const;
type FieldKey = (typeof fields)[number]["key"];
type Values = Record<FieldKey, string>;

function DeviceIcon({ mobile }: { mobile?: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {mobile ? (
        <>
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M10 18h4" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-5v5" />
        </>
      )}
    </svg>
  );
}

function FormSample({
  direction,
  values,
  onChange,
  visible,
  onVisibility,
}: {
  direction: Direction;
  values: Values;
  onChange: (key: FieldKey, value: string) => void;
  visible: Record<FieldKey, boolean>;
  onVisibility: (key: FieldKey, value: boolean) => void;
}) {
  const id = useId();
  return (
    <section
      className={`${styles.sample} ${styles[direction.id]}`}
      aria-label={`${direction.letter}안 ${direction.name}`}
    >
      <header className={styles.sampleHeader}>
        <span className={styles.sampleEyebrow}>프로필 설정 · 기본정보</span>
        <h2>
          연락·문의 안내 <span>선택</span>
        </h2>
        <p>공개할 연락 방법만 입력해주세요.</p>
      </header>
      <div className={styles.rows}>
        {fields.map((field) => (
          <div className={styles.row} key={field.key}>
            <label className={styles.fieldLabel} htmlFor={`${id}-${field.key}`}>
              {field.label}
            </label>
            <input
              className={styles.input}
              id={`${id}-${field.key}`}
              type={field.type}
              value={values[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <label className={styles.visibility}>
              <input
                type="checkbox"
                aria-label={`${direction.letter}안 ${field.label} 공개`}
                checked={visible[field.key]}
                onChange={(e) => onVisibility(field.key, e.target.checked)}
              />
              <span>공개</span>
            </label>
          </div>
        ))}
      </div>
      <footer className={styles.sampleFooter}>
        입력한 내용은 게시 전까지 공개되지 않습니다.
      </footer>
    </section>
  );
}

export function InputStylePreview() {
  const [active, setActive] = useState<Direction>(directions[0]);
  const [compare, setCompare] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [values, setValues] = useState<Values>({
    inquiry: "",
    phone: "",
    email: "hello@example.com",
    address: "서울특별시 강남구 테헤란로",
  });
  const [visible, setVisible] = useState<Record<FieldKey, boolean>>({
    inquiry: false,
    phone: false,
    email: false,
    address: true,
  });
  const onChange = (key: FieldKey, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  const onVisibility = (key: FieldKey, value: boolean) =>
    setVisible((v) => ({ ...v, [key]: value }));
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>PT Career · 화면 디자인</p>
          <h1>입력창 디자인 비교</h1>
          <p className={styles.lead}>
            같은 내용, 네 가지 표현. 입력칸을 눌러 선택했을 때의 모습도
            비교해보세요.
          </p>
        </div>
        <span className={styles.previewBadge}>디자인 미리보기</span>
      </header>
      <div className={styles.toolbar}>
        <nav className={styles.choices} aria-label="입력창 디자인">
          <button
            type="button"
            className={styles.compareButton}
            aria-pressed={compare}
            onClick={() => setCompare(true)}
          >
            모두 비교
          </button>
          {directions.map((d) => (
            <button
              type="button"
              key={d.id}
              aria-pressed={!compare && active.id === d.id}
              onClick={() => {
                setActive(d);
                setCompare(false);
              }}
            >
              <span>{d.letter}</span>
              {d.name}
            </button>
          ))}
        </nav>
        <div
          className={styles.deviceControls}
          role="group"
          aria-label="미리보기 폭"
        >
          <button
            type="button"
            aria-label="기본 폭"
            title="기본 폭"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <DeviceIcon />
          </button>
          <button
            type="button"
            aria-label="휴대폰 폭"
            title="휴대폰 폭"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            <DeviceIcon mobile />
          </button>
        </div>
      </div>
      <p className={styles.localNote}>
        이 화면의 입력과 공개 체크는 비교용이며 실제 프로필에 저장되지 않습니다.
      </p>
      <div
        className={`${styles.gallery} ${!compare ? styles.focused : ""} ${mobile ? styles.mobile : ""}`}
      >
        {(compare ? directions : [active]).map((d) => (
          <article className={styles.option} key={d.id}>
            <header className={styles.optionHeader}>
              <div className={styles.optionTitle}>
                <span className={styles.letter}>{d.letter}</span>
                <h2>{d.name}</h2>
                {"recommended" in d && (
                  <span className={styles.recommendation}>추천</span>
                )}
              </div>
              <p>{d.description}</p>
            </header>
            <div className={styles.stage}>
              <FormSample
                direction={d}
                values={values}
                onChange={onChange}
                visible={visible}
                onVisibility={onVisibility}
              />
            </div>
            <footer className={styles.optionFooter}>
              <p>{d.note}</p>
              {compare && (
                <button
                  type="button"
                  aria-label={`${d.letter}안 크게 보기`}
                  onClick={() => {
                    setActive(d);
                    setCompare(false);
                  }}
                >
                  크게 보기 <span aria-hidden="true">↗</span>
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </main>
  );
}
