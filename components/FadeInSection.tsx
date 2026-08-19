'use client';

import { useEffect, useRef, useState } from 'react';

// 랜딩페이지 느낌용 가벼운 등장 애니메이션. 스크롤 스냅은 카드 그리드처럼
// 길이가 가변인 섹션에서 내용이 잘려 보일 위험이 있어 쓰지 않고, 대신
// 섹션 진입 시 페이드인+슬라이드업 정도로만 리듬을 준다.
export function FadeInSection({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-safe:transition-all motion-safe:duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-6'
      }`}
    >
      {children}
    </div>
  );
}
