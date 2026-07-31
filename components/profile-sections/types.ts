// EditForm 맨 아래 통합 저장 바가 각 섹션의 저장을 원격으로 트리거하기 위한 핸들.
export type SectionSaveHandle = {
  save: () => Promise<{ ok: boolean; error?: string }>;
};
