import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PT Career — 내 주변 재활·운동 전문가 찾기",
  description: "경력과 자격으로 검증된 물리치료사, 트레이너, 재활 전문가를 찾아보세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
