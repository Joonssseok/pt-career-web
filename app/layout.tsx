import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
      <head>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #1f2937; }
          main { min-height: 100vh; display: flex; flex-direction: column; background: white; }
          nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem; }
          h1 { font-size: 1.25rem; font-weight: bold; color: #111827; }
          h2 { font-size: 1.875rem; font-weight: bold; color: #111827; line-height: 1.2; margin-bottom: 1rem; }
          p { font-size: 1rem; color: #4b5563; margin-bottom: 2rem; }
          button, a { text-decoration: none; color: inherit; }
          section { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; }
          footer { border-top: 1px solid #e5e7eb; padding: 1.5rem 1rem; text-align: center; font-size: 0.875rem; color: #6b7280; }
          .max-w-md { max-width: 28rem; margin: 0 auto; text-align: center; }
          .space-y-3 { display: flex; flex-direction: column; gap: 0.75rem; }
          .space-y-4 { display: flex; flex-direction: column; gap: 1rem; }
          .block { display: block; }
          .w-full { width: 100%; }
          .py-3 { padding: 0.75rem 0; }
          .py-4 { padding: 1rem 0; }
          .px-4 { padding: 0 1rem; }
          .rounded-lg { border-radius: 0.5rem; }
          .font-medium { font-weight: 500; }
          .text-center { text-align: center; }
          .cursor-pointer { cursor: pointer; }
          .transition-colors { transition: color 0.2s; }
          .bg-blue-600 { background-color: #2563eb; color: white; }
          .bg-blue-600:hover { background-color: #1d4ed8; }
          .border-2 { border: 2px solid; }
          .border-blue-600 { border-color: #2563eb; color: #2563eb; }
          .border-blue-600:hover { background-color: #f9fafb; }
          .text-blue-600 { color: #2563eb; }
          .bg-slate-50 { background-color: #f8fafc; }
          .border { border: 1px solid; }
          .border-slate-200 { border-color: #e2e8f0; }
          .p-4 { padding: 1rem; }
          .text-sm { font-size: 0.875rem; }
          .text-slate-700 { color: #374151; }
          .mt-6 { margin-top: 1.5rem; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
