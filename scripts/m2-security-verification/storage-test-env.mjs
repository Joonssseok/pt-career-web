import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../.env.local');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing environment variables');
  console.log('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.log('ANON_KEY:', ANON_KEY ? '✅' : '❌');
  process.exit(1);
}

const TEST_A_ID = 'e65c8e6f-6dc0-40e0-862b-09958c8699be';
const TEST_B_ID = '9864591d-7606-44de-947e-d161f4377a97';

async function testStorage() {
  console.log('🔐 Storage Isolation Test\n');

  try {
    // Create anon client
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    // Test 1: Check buckets exist
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('✅ Buckets:', buckets?.map(b => b.name).join(', '));

    // Test 2: Anonymous access should fail
    const { error: anonError } = await supabase.storage
      .from('profile-images')
      .list(`${TEST_A_ID}`);

    if (anonError) {
      console.log('✅ Anonymous access blocked');
    } else {
      console.log('❌ Anonymous access allowed (should be blocked)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testStorage();
