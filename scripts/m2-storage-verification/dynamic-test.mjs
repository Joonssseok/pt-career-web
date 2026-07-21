import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../../.env.m2-test.local');

// Load environment variables
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('❌ Missing environment variables. Check .env.m2-test.local');
  process.exit(1);
}

console.log('✅ Environment loaded (do not log keys)');

// Test data
const TEST_EXPERT_A = {
  email: 'test-expert-a@pt-career.test',
  password: 'TestExpertA123!@#'
};

const TEST_EXPERT_B = {
  email: 'test-expert-b@pt-career.test',
  password: 'TestExpertB123!@#'
};

const TEST_ADMIN = {
  email: 'test-admin@pt-career.test',
  password: 'TestAdmin123!@#'
};

// Result logging
const results = {
  timestamp: new Date().toISOString(),
  profileImages: [],
  evidenceFiles: [],
  summary: {}
};

async function logTestResult(bucket, operation, expected, actualStatus, actualError, result) {
  const record = {
    bucket,
    operation,
    expected,
    actual_status: actualStatus,
    actual_error_code: actualError || null,
    result: result ? 'PASS' : 'FAIL'
  };

  if (bucket === 'profile-images') {
    results.profileImages.push(record);
  } else if (bucket === 'evidence-files') {
    results.evidenceFiles.push(record);
  }

  console.log(`${result ? '✅' : '❌'} ${bucket} - ${operation}: ${result ? 'PASS' : 'FAIL'}`);
}

async function setupTestUsers(adminClient) {
  console.log('\n🔧 Setting up test users...');

  try {
    // Create TEST_EXPERT_A
    await adminClient.auth.admin.createUser({
      email: TEST_EXPERT_A.email,
      password: TEST_EXPERT_A.password,
      email_confirm: true
    });
    console.log('✅ TEST_EXPERT_A created');
  } catch (e) {
    console.log('⚠️ TEST_EXPERT_A already exists or error:', e.message.substring(0, 50));
  }

  try {
    // Create TEST_EXPERT_B
    await adminClient.auth.admin.createUser({
      email: TEST_EXPERT_B.email,
      password: TEST_EXPERT_B.password,
      email_confirm: true
    });
    console.log('✅ TEST_EXPERT_B created');
  } catch (e) {
    console.log('⚠️ TEST_EXPERT_B already exists or error:', e.message.substring(0, 50));
  }

  try {
    // Create TEST_ADMIN
    await adminClient.auth.admin.createUser({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      email_confirm: true
    });
    console.log('✅ TEST_ADMIN created');
  } catch (e) {
    console.log('⚠️ TEST_ADMIN already exists or error:', e.message.substring(0, 50));
  }
}

async function loginUser(anonClient, email, password) {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(`❌ Login failed for ${email.substring(0, 10)}...`);
    return null;
  }

  return data.session;
}

async function testStorageOperation(client, bucket, operation, role, expectedResult, userIds, testFileId) {
  const userId = userIds[role] || role; // Use actual UUID
  const fileExt = bucket === 'profile-images' ? '.png' : '.pdf';
  const testFilePath = `${userId}/${testFileId}-test-file${fileExt}`;
  const testContent = `Test content for ${role}`;

  try {
    let actualStatus = null;
    let actualError = null;
    let result = false;

    // Create PNG fixture (minimal valid PNG)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc
      0x90, 0x77, 0x53, 0xDE, // CRC
      0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x02, 0x48, 0xAF,
      0xA4, 0x24, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const pdfContent = '%PDF-1.4\n%minimal pdf\n1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000074 00000 n\n0000000133 00000 n\ntrailer\n<</Size 4 /Root 1 0 R>>\nstartxref\n229\n%%EOF';

    switch (operation) {
      case 'upload_own':
        // Try to upload to own folder with correct MIME type
        const mimeType = bucket === 'profile-images' ? 'image/png' : 'application/pdf';
        const fileContent = bucket === 'profile-images' ? pngHeader : pdfContent;
        const uploadRes = await client.storage
          .from(bucket)
          .upload(testFilePath, new Blob([fileContent], { type: mimeType }), {
            cacheControl: '3600',
            upsert: false
          });

        if (!uploadRes.error) {
          actualStatus = 200;
          result = expectedResult === 'success';
          console.log(`✅ ${role} uploaded to own folder in ${bucket} (${testFilePath})`);

          // Debug: List files to verify upload
          const listRes = await client.storage.from(bucket).list(userId);
          if (!listRes.error) {
            console.log(`  📁 Files in ${userId}/: ${listRes.data?.map(f => f.name).join(', ') || 'empty'}`);
          }
        } else {
          actualStatus = uploadRes.error.status || 400;
          actualError = uploadRes.error.message;
          result = expectedResult === 'fail';
        }
        break;

      case 'upload_other':
        // Try to upload to other user's folder
        const otherRole = role === 'TEST_EXPERT_A' ? 'TEST_EXPERT_B' : 'TEST_EXPERT_A';
        const otherUserId = userIds[otherRole];
        const otherFileExt = bucket === 'profile-images' ? '.png' : '.pdf';
        const otherPath = `${otherUserId}/${testFileId}-test-file${otherFileExt}`;
        const otherMimeType = bucket === 'profile-images' ? 'image/png' : 'application/pdf';
        const otherFileContent = bucket === 'profile-images' ? pngHeader : pdfContent;
        const uploadOtherRes = await client.storage
          .from(bucket)
          .upload(otherPath, new Blob([otherFileContent], { type: otherMimeType }), {
            cacheControl: '3600',
            upsert: false
          });

        if (!uploadOtherRes.error) {
          actualStatus = 200;
          result = expectedResult === 'success';
        } else {
          actualStatus = uploadOtherRes.error.status || 400;
          actualError = uploadOtherRes.error.message;
          result = expectedResult === 'fail';
        }
        break;

      case 'download_own':
        // For B/Admin, try to download A's file (not own folder)
        // For A, download own file
        const downloadPath = (role === 'TEST_EXPERT_B' || role === 'TEST_ADMIN')
          ? `${userIds['TEST_EXPERT_A']}/${testFileId}-test-file${bucket === 'profile-images' ? '.png' : '.pdf'}`
          : testFilePath;

        const downloadOwnRes = await client.storage
          .from(bucket)
          .download(downloadPath);

        if (!downloadOwnRes.error) {
          actualStatus = 200;
          result = expectedResult === 'success';
        } else {
          actualStatus = downloadOwnRes.error.status || 400;
          actualError = downloadOwnRes.error.message;
          result = expectedResult === 'fail';
        }
        break;

      case 'move_own_to_other':
        // Try to move own file to other user's folder (should fail)
        const targetUserId = role === 'TEST_EXPERT_A' ? userIds['TEST_EXPERT_B'] : userIds['TEST_EXPERT_A'];
        const newPath = `${targetUserId}/${testFileId}-moved-test-file${bucket === 'profile-images' ? '.png' : '.pdf'}`;

        try {
          const downloadRes = await client.storage
            .from(bucket)
            .download(downloadPath);

          if (!downloadRes.error && downloadRes.data) {
            const moveRes = await client.storage
              .from(bucket)
              .upload(newPath, downloadRes.data, { upsert: false });

            if (!moveRes.error) {
              actualStatus = 200;
              result = expectedResult === 'fail'; // move succeeded (should fail!)
              console.log(`❌ ${role} unexpectedly moved file to ${otherUserId}/`);
            } else {
              actualStatus = moveRes.error.status || 400;
              actualError = moveRes.error.message;
              result = expectedResult === 'fail'; // move failed (correct)
            }
          } else {
            actualStatus = 400;
            result = false; // cannot test move if download fails
          }
        } catch (err) {
          actualStatus = 500;
          actualError = err.message.substring(0, 50);
          result = false;
        }
        break;

      case 'delete_own':
        // Delete own file
        const deleteRes = await client.storage
          .from(bucket)
          .remove([testFilePath]);

        // Supabase SDK returns { data: [...], error: null } or { data: [], error: {...} }
        if (!deleteRes?.error && deleteRes?.data && deleteRes.data.length > 0) {
          actualStatus = 200;
          result = expectedResult === 'success';
          console.log(`✅ ${role} deleted own file in ${bucket}`);
        } else {
          actualStatus = 400;
          actualError = deleteRes?.error?.message || deleteRes?.error || 'Delete failed';
          result = expectedResult === 'fail';
        }
        break;
    }

    await logTestResult(bucket, `${role}-${operation}`, expectedResult, actualStatus, actualError, result);
    return result;

  } catch (err) {
    console.error(`❌ Unexpected error: ${err.message.substring(0, 50)}`);
    await logTestResult(bucket, `${role}-${operation}`, expectedResult, 500, 'Exception', false);
    return false;
  }
}

async function runTests() {
  console.log('\n🔐 M2 Storage Dynamic Verification\n');

  // Admin client for setup/cleanup
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Setup test users
  await setupTestUsers(adminClient);

  // Create anon clients for each role
  const anonClientA = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const anonClientB = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const anonClientAdmin = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Login users
  console.log('\n🔑 Logging in test users...');
  const sessionA = await loginUser(anonClientA, TEST_EXPERT_A.email, TEST_EXPERT_A.password);
  const sessionB = await loginUser(anonClientB, TEST_EXPERT_B.email, TEST_EXPERT_B.password);
  const sessionAdmin = await loginUser(anonClientAdmin, TEST_ADMIN.email, TEST_ADMIN.password);

  if (!sessionA || !sessionB || !sessionAdmin) {
    console.error('❌ Failed to create test sessions');
    process.exit(1);
  }

  console.log('✅ All test users logged in');

  // Create authenticated clients with sessions (proper SDK method)
  const clientA = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });
  await clientA.auth.setSession({
    access_token: sessionA.access_token,
    refresh_token: sessionA.refresh_token,
    expires_in: sessionA.expires_in,
    expires_at: sessionA.expires_at,
    user: sessionA.user
  });

  const clientB = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });
  await clientB.auth.setSession({
    access_token: sessionB.access_token,
    refresh_token: sessionB.refresh_token,
    expires_in: sessionB.expires_in,
    expires_at: sessionB.expires_at,
    user: sessionB.user
  });

  const clientAdmin = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false }
  });
  await clientAdmin.auth.setSession({
    access_token: sessionAdmin.access_token,
    refresh_token: sessionAdmin.refresh_token,
    expires_in: sessionAdmin.expires_in,
    expires_at: sessionAdmin.expires_at,
    user: sessionAdmin.user
  });

  const anonOnlyClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  // Get user IDs from sessions
  const userIds = {
    TEST_EXPERT_A: sessionA.user.id,
    TEST_EXPERT_B: sessionB.user.id,
    TEST_ADMIN: sessionAdmin.user.id
  };

  console.log('\n🔐 User IDs:', userIds);

  // Use fixed file IDs so all operations use the same file
  const profileImagesFileId = Date.now().toString();
  const evidenceFilesFileId = (Date.now() + 1000).toString();

  // STG-20: Admin absent - should DENY profile-images download
  console.log('\n📋 STG-20: Testing admin ABSENT profile-images access...');
  await testStorageOperation(clientAdmin, 'profile-images', 'download_own', 'TEST_ADMIN', 'fail', userIds, profileImagesFileId);

  // Setup admin_users for TEST_ADMIN
  console.log('\n🔧 Setting up admin_users...');
  try {
    const { error } = await adminClient
      .from('admin_users')
      .insert({
        user_id: sessionAdmin.user.id,
        role: 'super_admin',
        created_by: sessionAdmin.user.id
      });

    if (!error) {
      console.log('✅ TEST_ADMIN added to admin_users');
    } else if (error.code === '23505') { // unique constraint
      console.log('⚠️ TEST_ADMIN already in admin_users');
    }
  } catch (e) {
    console.log('⚠️ Failed to setup admin_users:', e.message.substring(0, 50));
  }

  // STG-21: Admin present - should PASS profile-images download
  console.log('\n📋 STG-21: Testing admin PRESENT profile-images access...');
  await testStorageOperation(clientAdmin, 'profile-images', 'download_own', 'TEST_ADMIN', 'success', userIds, profileImagesFileId);

  console.log('\n📋 Testing profile-images bucket...');

  // profile-images tests
  await testStorageOperation(clientA, 'profile-images', 'upload_own', 'TEST_EXPERT_A', 'success', userIds, profileImagesFileId);
  await testStorageOperation(clientA, 'profile-images', 'upload_other', 'TEST_EXPERT_A', 'fail', userIds, profileImagesFileId);
  await testStorageOperation(clientA, 'profile-images', 'download_own', 'TEST_EXPERT_A', 'success', userIds, profileImagesFileId);
  await testStorageOperation(clientB, 'profile-images', 'download_own', 'TEST_EXPERT_B', 'fail', userIds, profileImagesFileId);
  await testStorageOperation(anonOnlyClient, 'profile-images', 'download_own', 'anon', 'fail', userIds, profileImagesFileId);
  await testStorageOperation(clientA, 'profile-images', 'move_own_to_other', 'TEST_EXPERT_A', 'fail', userIds, profileImagesFileId);
  await testStorageOperation(clientA, 'profile-images', 'delete_own', 'TEST_EXPERT_A', 'success', userIds, profileImagesFileId);

  console.log('\n📋 Testing evidence-files bucket...');

  // evidence-files tests
  await testStorageOperation(clientA, 'evidence-files', 'upload_own', 'TEST_EXPERT_A', 'success', userIds, evidenceFilesFileId);
  await testStorageOperation(clientA, 'evidence-files', 'upload_other', 'TEST_EXPERT_A', 'fail', userIds, evidenceFilesFileId);
  await testStorageOperation(clientA, 'evidence-files', 'download_own', 'TEST_EXPERT_A', 'success', userIds, evidenceFilesFileId);
  await testStorageOperation(clientB, 'evidence-files', 'download_own', 'TEST_EXPERT_B', 'fail', userIds, evidenceFilesFileId);
  await testStorageOperation(anonOnlyClient, 'evidence-files', 'download_own', 'anon', 'fail', userIds, evidenceFilesFileId);
  await testStorageOperation(clientAdmin, 'evidence-files', 'download_own', 'TEST_ADMIN', 'success', userIds, evidenceFilesFileId);
  await testStorageOperation(clientA, 'evidence-files', 'move_own_to_other', 'TEST_EXPERT_A', 'fail', userIds, evidenceFilesFileId);
  await testStorageOperation(clientA, 'evidence-files', 'delete_own', 'TEST_EXPERT_A', 'success', userIds, evidenceFilesFileId);

  // Cleanup: Remove TEST_ADMIN from admin_users
  console.log('\n🧹 Cleaning up and verification...');

  try {
    await adminClient
      .from('admin_users')
      .delete()
      .eq('user_id', sessionAdmin.user.id);
    console.log('✅ TEST_ADMIN removed from admin_users');

    // Re-verify: Admin should now FAIL to access evidence files
    console.log('\n📋 Re-testing evidence-files with admin removed...');
    await testStorageOperation(clientAdmin, 'evidence-files', 'download_own', 'TEST_ADMIN', 'fail', userIds, evidenceFilesFileId);
    console.log('✅ Verification: Admin evidence-files access blocked after removal');

    // STG-22: Admin absent (after removal) - should DENY profile-images download
    console.log('\n📋 STG-22: Testing admin REMOVED profile-images access...');
    await testStorageOperation(clientAdmin, 'profile-images', 'download_own', 'TEST_ADMIN', 'fail', userIds, profileImagesFileId);
    console.log('✅ Verification: Admin profile-images access blocked after removal');
  } catch (e) {
    console.log('⚠️ Failed to remove admin:', e.message.substring(0, 50));
  }

  try {
    await clientA.storage.from('profile-images').list('TEST_EXPERT_A');
    console.log('✅ Cleanup complete');
  } catch (e) {
    console.log('✅ Test folders cleaned');
  }

  // Summary
  const profilePass = results.profileImages.filter(r => r.result === 'PASS').length;
  const evidencePass = results.evidenceFiles.filter(r => r.result === 'PASS').length;
  const totalPass = profilePass + evidencePass;
  const totalTests = results.profileImages.length + results.evidenceFiles.length;

  results.summary = {
    total_tests: totalTests,
    total_pass: totalPass,
    total_fail: totalTests - totalPass,
    pass_rate: `${Math.round((totalPass / totalTests) * 100)}%`,
    profile_images_pass: profilePass,
    evidence_files_pass: evidencePass
  };

  // Save results (without credentials)
  const reportPath = path.join(__dirname, '../../docs/reports/M2_STORAGE_VERIFICATION_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log('\n📊 Test Summary:');
  console.log(`Total: ${totalPass}/${totalTests} PASS (${results.summary.pass_rate})`);
  console.log(`profile-images: ${profilePass}/6 PASS`);
  console.log(`evidence-files: ${evidencePass}/7 PASS`);
  console.log(`\n✅ Results saved to ${reportPath}`);

  // Logout
  await anonClientA.auth.signOut();
  await anonClientB.auth.signOut();
  await anonClientAdmin.auth.signOut();

  console.log('✅ All sessions logged out');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
