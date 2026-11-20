"use client";
import { useEffect, useState } from "react";
import {
  EvidenceMaskingDialog,
  type MaskedEvidenceCopy,
} from "@/components/evidence/EvidenceMaskingDialog";
export function EvidenceMaskingPreview() {
  const [open, setOpen] = useState(true),
    [copies, setCopies] = useState<MaskedEvidenceCopy[]>([]);
  const [copyUrl, setCopyUrl] = useState("");
  useEffect(() => {
    if (!copies[0]) return;
    const url = URL.createObjectURL(copies[0].file);
    setCopyUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [copies]);
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-xl font-bold">가상 자료로 보는 개인정보 가리기</h1>
      <p className="my-4">
        실제 개인정보·면허가 아닌 시험용 문서입니다. 저장·업로드·심사 요청은
        하지 않습니다.
      </p>
      <button
        className="min-h-12 rounded-xl bg-blue-600 px-6 text-white"
        onClick={() => setOpen(true)}
      >
        가리기 미리보기 열기
      </button>
      {copies.length > 0 && (
        <p role="status">
          새 JPEG 사본 {copies.length}개를 기기 안에서 만들었습니다. 원본·서버는
          변경하지 않았습니다.
        </p>
      )}
      {copyUrl && (
        <>
          <a
            className="my-4 block min-h-12 text-blue-600"
            href={copyUrl}
            download="masked-preview.jpg"
          >
            가린 사본 내려받기 · 미리보기 전용
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={copyUrl}
            alt="완성된 가린 사본"
            className="mt-4 max-w-full"
          />
        </>
      )}
      {open && (
        <EvidenceMaskingDialog
          ownName="홍길동"
          files={[
            {
              id: "masking-sample",
              name: "가상 면허 예시.png",
              href: "/preview/masking-sample.png",
              type: "image/png",
            },
          ]}
          onCancel={() => setOpen(false)}
          onComplete={(files) => {
            setCopies(files);
            setOpen(false);
          }}
        />
      )}
    </main>
  );
}
