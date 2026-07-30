'use client';

import { useState } from 'react';
import { setOwnProfileVisibility } from '@/app/actions/profile';
import { VisibilityToggle } from '@/components/profile-sections/VisibilityToggle';

// 프로필 전체를 가리는 마스터 토글 — 켜져 있어야 각 섹션의 항목별 공개
// 설정이 의미를 갖는다(꺼지면 항목 값과 무관하게 전체 비공개).
export function ProfileVisibilityToggle({ initialVisible }: { initialVisible: boolean }) {
  const [visible, setVisible] = useState(initialVisible);
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    const nextVisible = !visible;
    setPending(true);
    setVisible(nextVisible);

    const result = await setOwnProfileVisibility(nextVisible);
    if (!result.ok) {
      setVisible(!nextVisible);
      alert(result.error);
    }
    setPending(false);
  };

  return <VisibilityToggle visible={visible} onToggle={handleToggle} pending={pending} />;
}
