import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Test UUIDs
const TEST_A_ID = 'e65c8e6f-6dc0-40e0-862b-09958c8699be';
const TEST_B_ID = '9864591d-7606-44de-947e-d161f4377a97';

// Test results
const results = {
  profile_images: {},
  evidence_files: {},
};

async function testProfileImages() {
  console.log('\n=== TEST 11: Storage Isolation - profile-images ===\n');

  // Test 1: A → A 폴더 업로드 성공
  try {
    const supabaseA = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    await supabaseA.auth.signInWithPassword({
      email: `test-a@example.com`,
      password: 'testpassword',
    });

    const fileName = `${TEST_A_ID}/test-a.txt`;
    const { error } = await supabaseA.storage
      .from('profile-images')
      .upload(fileName, new File(['test'], 'test.txt'), { upsert: true });

    if (!error) {
      console.log('✅ TEST 1: A → A 폴더 업로드 성공');
      results.profile_images['A_upload_own'] = 'PASS';
    } else {
      console.log('❌ TEST 1: A → A 폴더 업로드 실패', error.message);
      results.profile_images['A_upload_own'] = 'FAIL';
    }

    // Test 2: A → B 폴더 업로드 실패 (접근 불가)
    const fileNameB = `${TEST_B_ID}/test-from-a.txt`;
    const { error: errorB } = await supabaseA.storage
      .from('profile-images')
      .upload(fileNameB, new File(['test'], 'test.txt'), { upsert: true });

    if (errorB) {
      console.log('✅ TEST 2: A → B 폴더 업로드 실패 (차단됨)');
      results.profile_images['A_upload_other'] = 'PASS';
    } else {
      console.log('❌ TEST 2: A → B 폴더 업로드 성공 (예상 실패)');
      results.profile_images['A_upload_other'] = 'FAIL';
    }

    // Test 3: B → A 파일 접근 실패
    const supabaseB = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    await supabaseB.auth.signInWithPassword({
      email: `test-b@example.com`,
      password: 'testpassword',
    });

    const { error: errorAccess } = await supabaseB.storage
      .from('profile-images')
      .download(`${TEST_A_ID}/test-a.txt`);

    if (errorAccess) {
      console.log('✅ TEST 3: B → A 파일 접근 실패 (차단됨)');
      results.profile_images['B_access_other'] = 'PASS';
    } else {
      console.log('❌ TEST 3: B → A 파일 접근 성공 (예상 실패)');
      results.profile_images['B_access_other'] = 'FAIL';
    }

    // Clean up: A의 파일 삭제
    await supabaseA.storage
      .from('profile-images')
      .remove([`${TEST_A_ID}/test-a.txt`]);
  } catch (error) {
    console.error('profile-images 테스트 오류:', error.message);
  }
}

async function testEvidenceFiles() {
  console.log('\n=== TEST 11: Storage Isolation - evidence-files ===\n');

  try {
    const supabaseA = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    await supabaseA.auth.signInWithPassword({
      email: `test-a@example.com`,
      password: 'testpassword',
    });

    // Test 1: A → A 폴더 업로드 성공
    const fileName = `${TEST_A_ID}/evidence.txt`;
    const { error } = await supabaseA.storage
      .from('evidence-files')
      .upload(fileName, new File(['evidence'], 'evidence.txt'), { upsert: true });

    if (!error) {
      console.log('✅ TEST 1: A → A 폴더 업로드 성공');
      results.evidence_files['A_upload_own'] = 'PASS';
    } else {
      console.log('❌ TEST 1: A → A 폴더 업로드 실패', error.message);
      results.evidence_files['A_upload_own'] = 'FAIL';
    }

    // Test 2: B → A 파일 접근 실패
    const supabaseB = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    await supabaseB.auth.signInWithPassword({
      email: `test-b@example.com`,
      password: 'testpassword',
    });

    const { error: errorAccess } = await supabaseB.storage
      .from('evidence-files')
      .download(`${TEST_A_ID}/evidence.txt`);

    if (errorAccess) {
      console.log('✅ TEST 2: B → A 파일 접근 실패 (차단됨)');
      results.evidence_files['B_access_other'] = 'PASS';
    } else {
      console.log('❌ TEST 2: B → A 파일 접근 성공 (예상 실패)');
      results.evidence_files['B_access_other'] = 'FAIL';
    }

    // Clean up
    await supabaseA.storage
      .from('evidence-files')
      .remove([`${TEST_A_ID}/evidence.txt`]);
  } catch (error) {
    console.error('evidence-files 테스트 오류:', error.message);
  }
}

async function main() {
  console.log('🔐 M2 Security: Storage Isolation Test');
  console.log('=====================================\n');

  await testProfileImages();
  await testEvidenceFiles();

  console.log('\n=== 최종 결과 ===\n');
  console.log('profile-images:', results.profile_images);
  console.log('evidence-files:', results.evidence_files);

  const allPass = Object.values(results.profile_images).every(v => v === 'PASS') &&
                  Object.values(results.evidence_files).every(v => v === 'PASS');

  console.log(`\n결론: ${allPass ? '✅ ALL PASS' : '⚠️ SOME FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
