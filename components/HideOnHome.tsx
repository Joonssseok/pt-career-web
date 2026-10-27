'use client';

import { usePathname } from 'next/navigation';

// 랜딩(/)은 헤더 없이 전체 화면으로 보여준다.
export function HideOnHome({ children }: { children: React.ReactNode }) {
  return usePathname() === '/' ? null : children;
}
