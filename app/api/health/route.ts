import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    // `specialties` is small, static reference data with public anon SELECT access
    // (unlike `profiles`, which anon has no direct grant on since the M4 lockdown).
    const { error } = await supabase.from('specialties').select('id', { count: 'exact', head: true }).limit(1);

    if (error) {
      console.error('[health] Supabase check failed:', error);
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[health] threw:', err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
