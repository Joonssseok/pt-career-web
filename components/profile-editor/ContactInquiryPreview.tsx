"use client";

import { useId, useState } from "react";
import styles from "./ContactInquiryPreview.module.css";
import { NaverContactMap, NaverLocationPicker } from "./NaverLocationPicker";
import type { ContactKey } from "@/lib/profile-versions/contact-inquiry";

import {
  contactHref,
  emptyContactInquiry,
  publicContactInquiry,
  type ContactInquiry as ContactInquiryDraft,
  type PublicContactInquiry,
} from "@/lib/profile-versions/contact-inquiry";
export { emptyContactInquiry };
export type { ContactInquiryDraft };

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
    placeholder: "전화번호를 입력해주세요",
    type: "tel",
  },
  {
    key: "email",
    label: "공개 이메일",
    placeholder: "업무용 이메일을 입력해주세요",
    type: "email",
  },
  {
    key: "address",
    label: "방문 주소",
    placeholder: "방문 가능한 근무지 주소",
    type: "text",
  },
] as const;

export function ContactInquiryFields({
  value,
  onChange,
}: {
  value: ContactInquiryDraft;
  onChange: (value: ContactInquiryDraft) => void;
}) {
  const id = useId();
  return (
    <section className={styles.editor} aria-labelledby={`${id}-title`}>
      <header>
        <h3 id={`${id}-title`}>
          연락·문의 안내 <span>선택</span>
        </h3>
        <p>공개할 연락 방법만 입력해주세요. 로그인 정보와 별도로 설정합니다.</p>
        <p className={styles.previewNote}>
          저장한 내용은 비공개로 보관됩니다. 프로필을 게시하면 공개 설정이
          반영됩니다.
        </p>
      </header>
      {fields.map(({ key, label, placeholder, type }) => {
        const invalid =
          !!value[key].value.trim() && !contactHref(key, value[key].value);
        return (
          <div className={styles.field} key={key}>
            {key === "address" && (
              <NaverLocationPicker
                onSelect={(location) =>
                  onChange({
                    ...value,
                    location,
                    address: { ...value.address, value: location.address },
                    detailAddress: "",
                  })
                }
              />
            )}
            <div className={styles.fieldHeading}>
              <label htmlFor={`${id}-${key}`}>{label}</label>
              <input
                id={`${id}-${key}`}
                type={type}
                value={value[key].value}
                readOnly={key === "address"}
                placeholder={placeholder}
                maxLength={
                  key === "inquiry" ? 500 : key === "address" ? 300 : 160
                }
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-${key}-error` : undefined}
                onChange={
                  key === "address"
                    ? undefined
                    : (event) =>
                        onChange({
                          ...value,
                          [key]: { ...value[key], value: event.target.value },
                        })
                }
              />
              <label className={styles.visibility}>
                <input
                  type="checkbox"
                  checked={value[key].visible}
                  aria-label={`${label} 공개`}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      [key]: { ...value[key], visible: event.target.checked },
                    })
                  }
                />
                공개
              </label>
            </div>
            {key === "address" && (
              <>
                {value.location && (
                  <button
                    type="button"
                    className={styles.clearLocation}
                    onClick={() =>
                      onChange({
                        ...value,
                        location: null,
                        address: { value: "", visible: false },
                        detailAddress: "",
                        mapVisible: false,
                      })
                    }
                  >
                    주소 선택 해제
                  </button>
                )}
                {value.location?.name && (
                  <p className={styles.searchHint}>
                    선택한 업체: {value.location.name}
                  </p>
                )}
                <label className={styles.caption}>
                  상세주소
                  <input
                    type="text"
                    value={value.detailAddress}
                    maxLength={120}
                    placeholder="층·호수 등 (선택)"
                    disabled={!value.location}
                    onChange={(event) =>
                      onChange({ ...value, detailAddress: event.target.value })
                    }
                  />
                </label>
                <label className={styles.visibility}>
                  <input
                    type="checkbox"
                    aria-label="지도 공개"
                    checked={value.mapVisible}
                    disabled={!value.location}
                    onChange={(event) =>
                      onChange({ ...value, mapVisible: event.target.checked })
                    }
                  />
                  지도 공개
                </label>
                <p className={styles.searchHint}>
                  주소 공개와 별도로 설정합니다. 지도에는 선택한 건물 위치만
                  표시합니다.
                </p>
              </>
            )}
            {invalid && (
              <p id={`${id}-${key}-error`} className={styles.error}>
                올바른 {key === "inquiry" ? "http 또는 https 주소" : label}를
                입력해주세요.
              </p>
            )}
            {key === "inquiry" && (
              <label className={styles.caption}>
                버튼 문구
                <input
                  type="text"
                  value={value.inquiryLabel}
                  maxLength={24}
                  placeholder="수업 문의하기"
                  onChange={(event) =>
                    onChange({ ...value, inquiryLabel: event.target.value })
                  }
                />
              </label>
            )}
          </div>
        );
      })}
    </section>
  );
}

function ContactIcon({ kind }: { kind: ContactKey }) {
  const paths = {
    inquiry: (
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
    ),
    phone: (
      <path d="m4 3 4 1 1 5-3 2a15 15 0 0 0 7 7l2-3 5 1 1 4c-1 4-9 1-13-3S1 4 4 3Z" />
    ),
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    address: (
      <>
        <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}

export function ContactInquiryCard({ value }: { value: ContactInquiryDraft }) {
  return (
    <PublicContactInquiryCard value={publicContactInquiry(value)} preview />
  );
}

function PhoneContact({ phone, href }: { phone: string; href: string }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        data-profile-contact
        className={`${styles.contact} ${styles.phoneToggle}`}
        aria-expanded={shown}
        aria-controls={id}
        onClick={() => setShown((previous) => !previous)}
      >
        <ContactIcon kind="phone" />
        <span>전화연결</span>
      </button>
      <div id={id} hidden={!shown}>
        {shown && (
          <a
            data-profile-contact
            className={`${styles.contact} ${styles.phoneNumber}`}
            href={href}
          >
            {phone}
          </a>
        )}
      </div>
    </div>
  );
}

export function PublicContactInquiryCard({
  value,
  preview = false,
}: {
  value: PublicContactInquiry;
  preview?: boolean;
}) {
  const links = [
    {
      key: "inquiry" as const,
      text: value.inquiry?.label || "수업 문의하기",
      href: contactHref("inquiry", value.inquiry?.url || ""),
    },
    {
      key: "phone" as const,
      text: value.phone,
      href: contactHref("phone", value.phone || ""),
    },
    {
      key: "email" as const,
      text: value.email,
      href: contactHref("email", value.email || ""),
    },
  ].filter((row) => row.href);
  if (!links.length && !value.address && !value.map) return null;
  return (
    <section
      className={styles.card}
      aria-label={preview ? "연락·문의 안내 미리보기" : "연락·문의 안내"}
    >
      {links.map(({ key, text, href }) =>
        key === "phone" ? (
          <PhoneContact key={href} phone={text!} href={href!} />
        ) : (
          <a
            key={key}
            data-profile-contact
            className={
              styles.contact + (key === "inquiry" ? " " + styles.inquiry : "")
            }
            href={href!}
            target={key === "inquiry" ? "_blank" : undefined}
            rel={key === "inquiry" ? "noopener noreferrer" : undefined}
          >
            <ContactIcon kind={key} />
            <span>{text}</span>
          </a>
        ),
      )}
      {value.address && (
        <p className={`${styles.contact} ${styles.address}`}>
          <ContactIcon kind="address" />
          <span className={styles.addressText}>
            {value.address.name && (
              <span className={styles.workplaceName}>{value.address.name}</span>
            )}
            <span
              className={value.address.name ? styles.addressDetail : undefined}
            >
              {[value.address.base, value.address.detail]
                .filter(Boolean)
                .join(" ")}
            </span>
          </span>
        </p>
      )}
      {value.map && <NaverContactMap location={value.map} />}
    </section>
  );
}
