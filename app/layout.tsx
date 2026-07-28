import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "PT Career — 내 주변 재활·운동 전문가 찾기",
  description: "경력과 자격으로 검증된 물리치료사, 트레이너, 재활 전문가를 찾아보세요.",
  openGraph: {
    title: "PT Career — 내 주변 재활·운동 전문가 찾기",
    description: "경력과 자격으로 검증된 물리치료사, 트레이너, 재활 전문가를 찾아보세요.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
