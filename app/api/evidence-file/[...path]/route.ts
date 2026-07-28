import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join('/');

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('evidence-files').download(path);

  if (error || !data) {
    if (error) {
      console.error('[evidence-file] download error:', error);
    }
    return new NextResponse(null, { status: 404 });
  }

  const buffer = await data.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
