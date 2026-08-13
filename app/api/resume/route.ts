import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOwnResumeData } from '@/app/actions/resume';
import { buildResumeDocx, type ResumePhoto } from '@/lib/resume/build-resume-docx';

export const dynamic = 'force-dynamic';

// docx의 ImageRun은 jpg/png/gif/bmp만 지원한다(webp 미지원). 프로필 사진
// 업로드는 jpg/png/webp를 허용하므로, webp인 경우는 이미지 삽입을
// 포기하고 자리표시 박스로 대체한다(별도 이미지 변환 라이브러리 없이).
function docxImageTypeFromPath(path: string): 'jpg' | 'png' | null {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'png') return 'png';
  return null;
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').trim() || '전문가';
}

export async function GET() {
  // TODO: 유료 게이팅 훅 -- 현재는 항상 통과. 결제 연동(별도 티켓)이
  // 들어오면 여기서 구독/구매 여부를 확인하고 미충족 시 402/403을 반환.

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const result = await getOwnResumeData();
  if (!result.ok) {
    const status = result.error === 'Profile not found' ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const { data } = result;

  let photo: ResumePhoto = null;
  if (data.profileImagePath) {
    const imageType = docxImageTypeFromPath(data.profileImagePath);
    if (imageType) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('profile-images')
        .download(data.profileImagePath);
      if (!downloadError && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        photo = { buffer: Buffer.from(arrayBuffer), type: imageType };
      }
    }
  }

  const buffer = await buildResumeDocx(data, photo);
  const filename = `PT Career 이력서_${sanitizeFilenamePart(data.displayName)}.docx`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="resume.docx"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
