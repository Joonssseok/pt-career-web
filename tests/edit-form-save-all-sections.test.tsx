/**
 * @jest-environment jsdom
 *
 * Regression test for two active data-loss bugs fixed together
 * (2026-08-13 지시서, both in app/expert/edit/EditForm.tsx):
 *
 * 1. [urgent] "업로드"(handleSubmitForReview) only ever called
 *    submit_profile() -- it never saved the on-screen (React state) content
 *    first. submit_profile() just flips an already-saved DB row public, so
 *    clicking "업로드" without a prior "임시저장" silently dropped whatever
 *    the user had just typed (confirmed against prod: a real user's
 *    profile_extra_links had 0 rows after they filled the form and clicked
 *    "업로드"). Fixed by making "업로드" call the same saveAllSections()
 *    that "임시저장" calls, and only proceeding to submit_profile() if that
 *    save succeeds.
 * 2. [urgent] saveAllSections()'s saveOwnProfile() call omitted
 *    coverImagePath/youtubeUrl/instagramUrl/blogUrl/threadsUrl/kakaoUrl.
 *    save_own_profile() treats an omitted field as DEFAULT NULL and
 *    unconditionally overwrites the column with it, so every "임시저장"
 *    click was silently nulling out a real user's already-saved cover image
 *    and social links. Fixed by including every formData field in the call.
 *
 * This test stubs every child profile-section component as a trivial
 * forwardRef exposing save(), and every server action, so it can render the
 * real EditForm and drive its actual save wiring without touching Supabase.
 */
import { forwardRef, useImperativeHandle } from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import EditForm from '@/app/expert/edit/EditForm';
import { saveOwnProfile, submitProfile } from '@/app/actions/profile';

jest.mock('@/app/actions/profile', () => ({
  getOwnProfile: jest.fn().mockResolvedValue({
    ok: true,
    profile: {
      id: 'profile-1',
      display_name: '테스트',
      headline: '',
      introduction: '',
      profile_image_path: 'user/photo.jpg',
      cover_image_path: 'user/cover.jpg',
      youtube_url: 'https://youtube.com/@existing',
      instagram_url: '',
      blog_url: '',
      threads_url: '',
      kakao_url: '',
      verification_status: 'draft',
      owner_visible: true,
    },
  }),
  getOwnResumePhone: jest.fn().mockResolvedValue({ ok: true, phone: '' }),
  getOwnRejectionReason: jest.fn().mockResolvedValue({ ok: true, reason: null }),
  saveOwnProfile: jest.fn().mockResolvedValue({ ok: true }),
  submitProfile: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('@/app/actions/terms', () => ({
  getOwnTermsAgreedAt: jest.fn().mockResolvedValue({ ok: true, agreedAt: '2026-01-01' }),
  agreeToTerms: jest.fn().mockResolvedValue({ ok: true }),
}));

// 9개 하위 섹션을 전부 "즉시 성공"하는 더미로 대체 -- 이 테스트가 보려는
// 건 EditForm이 실제로 저장을 "언제" 트리거하는지와 saveOwnProfile에
// "무엇을" 넘기는지지, 각 섹션 자체의 저장 로직이 아니다.
function makeStubSection(name: string) {
  const Stub = forwardRef((_props, ref) => {
    useImperativeHandle(ref, () => ({ save: async () => ({ ok: true }) }));
    return null;
  });
  Stub.displayName = name;
  return Stub;
}

jest.mock('@/components/profile-sections/AcademicSection', () => makeStubSection('AcademicSection'));
jest.mock('@/components/profile-sections/ExperienceSection', () => makeStubSection('ExperienceSection'));
jest.mock('@/components/profile-sections/EducationSection', () => makeStubSection('EducationSection'));
jest.mock('@/components/profile-sections/CertificationSection', () => makeStubSection('CertificationSection'));
jest.mock('@/components/profile-sections/WorkplaceSection', () => makeStubSection('WorkplaceSection'));
jest.mock('@/components/profile-sections/ProfessionSection', () => makeStubSection('ProfessionSection'));
jest.mock('@/components/profile-sections/SpecialtySection', () => makeStubSection('SpecialtySection'));
jest.mock('@/components/profile-sections/GallerySection', () => makeStubSection('GallerySection'));
jest.mock('@/components/profile-sections/ExtraLinksSection', () => makeStubSection('ExtraLinksSection'));

async function renderAndWaitForLoad() {
  const utils = render(<EditForm />);
  await waitFor(() => expect(utils.getByText('임시저장')).toBeTruthy());
  return utils;
}

describe('EditForm save wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (saveOwnProfile as jest.Mock).mockResolvedValue({ ok: true });
    (submitProfile as jest.Mock).mockResolvedValue({ ok: true });
  });

  it('임시저장을 두 번 눌러도 커버 이미지/유튜브 링크가 매번 saveOwnProfile 호출에 그대로 포함된다 (NULL로 덮어쓰지 않음)', async () => {
    const { getByText } = await renderAndWaitForLoad();
    const draftButton = getByText('임시저장');

    await act(async () => {
      fireEvent.click(draftButton);
    });
    await act(async () => {
      fireEvent.click(draftButton);
    });

    expect(saveOwnProfile).toHaveBeenCalledTimes(2);
    for (const call of (saveOwnProfile as jest.Mock).mock.calls) {
      expect(call[0]).toMatchObject({
        coverImagePath: 'user/cover.jpg',
        youtubeUrl: 'https://youtube.com/@existing',
      });
    }
  });

  it('"업로드"는 submit_profile()을 호출하기 전에 반드시 saveOwnProfile()로 화면 내용을 먼저 저장한다', async () => {
    const { getByText, getAllByText } = await renderAndWaitForLoad();

    // 하단 고정바의 "업로드"는 확인 모달을 여는 버튼이고, 모달 안의
    // "업로드"가 실제 handleSubmitForReview를 호출하는 버튼이다(둘 다
    // 텍스트가 "업로드"라 getByText 단독으로는 중복 매치가 남).
    fireEvent.click(getByText('업로드'));
    await act(async () => {
      const uploadButtons = getAllByText('업로드');
      fireEvent.click(uploadButtons[uploadButtons.length - 1]);
    });

    await waitFor(() => expect(submitProfile).toHaveBeenCalled());

    expect(saveOwnProfile).toHaveBeenCalled();
    const saveOrder = (saveOwnProfile as jest.Mock).mock.invocationCallOrder[0];
    const submitOrder = (submitProfile as jest.Mock).mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(submitOrder);
  });

  it('저장이 실패하면 submit_profile()을 호출하지 않고 업로드를 중단한다', async () => {
    (saveOwnProfile as jest.Mock).mockResolvedValue({ ok: false, error: 'boom' });
    const { getByText, getAllByText } = await renderAndWaitForLoad();

    fireEvent.click(getByText('업로드'));
    await act(async () => {
      const uploadButtons = getAllByText('업로드');
      fireEvent.click(uploadButtons[uploadButtons.length - 1]);
    });

    await waitFor(() => expect(saveOwnProfile).toHaveBeenCalled());
    expect(submitProfile).not.toHaveBeenCalled();
  });
});
