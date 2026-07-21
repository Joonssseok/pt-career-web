# Test Script Revision Instructions — STG-01~22

**Target File**: `scripts/m2-storage-verification/dynamic-test.mjs`

**Purpose**: Fix Move test errors, separate admin test data, implement stricter verification

---

## Part 1: Move Test Variable Fix

### Current Issue
```
Error: Cannot access 'downloadPath' before initialization
Location: Move test (downloadPath undefined)
```

### Fix Required

**Problem**: Variable scope issue in move operation

**Solution**: Initialize all variables before use

**Code Location**: `testStorageOperation()` function, move_own_to_other case

**Required Changes**:
```javascript
// BEFORE (incorrect)
const downloadPath = `${ownerFolder}/${fileId}.${ext}`;
const targetPath = `${targetFolder}/${fileId}.${ext}`;
const downloadedFile = await download(downloadPath); // ERROR: downloadPath might be undefined

// AFTER (correct)
const ownerFolder = userIds[role];  // Ensure ownerFolder is defined
const ext = bucket === 'profile-images' ? 'png' : 'pdf';
const fileId = testFileId;

// THEN use variables
const downloadPath = `${ownerFolder}/${fileId}.${ext}`;
const targetPath = `${targetFolder}/${fileId}.${ext}`;
const downloadedFile = await download(downloadPath);
```

**Verification**: STG-06 and STG-14 should execute without 500 error

---

## Part 2: Separate Admin Test Fixtures

### Current Issue
- Admin tests use same files as user delete tests
- Files deleted in STG-07/STG-16 before admin tests (STG-17~22)
- "Object not found" errors in admin tests not conclusive

### Fix Required

**Step 1: Create Separate Fixture Files**

```javascript
// BEFORE (all tests use same file)
const profileImagesFileId = Date.now().toString();
const evidenceFilesFileId = (Date.now() + 1000).toString();

// AFTER (separate fixtures)
const userTestFileId = Date.now().toString();
const adminTestFileId = (Date.now() + 10000).toString(); // Different ID

const profileImagesUserFile = userTestFileId;
const profileImagesAdminFile = adminTestFileId;

const evidenceFilesUserFile = userTestFileId;
const evidenceFilesAdminFile = adminTestFileId;
```

**Step 2: Upload Admin Fixtures Before Tests**

```javascript
// After login, before STG-17
console.log('\n📝 Creating admin test fixtures...');

// Create profile-images admin fixture (owned by TEST_EXPERT_A)
const adminProfilePath = `${userIds['TEST_EXPERT_A']}/${adminTestFileId}-admin-fixture.png`;
await clientA.storage.from('profile-images').upload(
  adminProfilePath,
  new Blob([/* binary PNG data */], {type: 'image/png'})
);
console.log('✅ Admin profile-images fixture created');

// Create evidence-files admin fixture (owned by TEST_EXPERT_A)
const adminEvidencePath = `${userIds['TEST_EXPERT_A']}/${adminTestFileId}-admin-fixture.pdf`;
await clientA.storage.from('evidence-files').upload(
  adminEvidencePath,
  new Blob([/* binary PDF data */], {type: 'application/pdf'})
);
console.log('✅ Admin evidence-files fixture created');
```

**Step 3: Pre-check Fixtures Before Admin Tests**

```javascript
// STG-17 (before admin tests)
console.log('\n✅ Pre-check: Admin fixtures exist');
const profileCheck = await clientA.storage.from('profile-images')
  .download(`${userIds['TEST_EXPERT_A']}/${adminTestFileId}-admin-fixture.png`);
const evidenceCheck = await clientA.storage.from('evidence-files')
  .download(`${userIds['TEST_EXPERT_A']}/${adminTestFileId}-admin-fixture.pdf`);

if (!profileCheck.error && !evidenceCheck.error) {
  console.log('✅ Both fixtures confirmed ready');
} else {
  console.log('❌ Fixture missing, abort admin tests');
  process.exit(1);
}
```

---

## Part 3: Enhanced Admin Test Logging

### Required Logging Format

**For each admin test (STG-17~22)**:

```javascript
console.log(`
STG-${testNumber}: ${testName}
├─ Client user: [TEST_EXPERT_A / TEST_ADMIN / anon]
├─ File owner: [REDACTED_UUID]
├─ Bucket: [profile-images / evidence-files]
├─ File path: ${userIds['TEST_EXPERT_A']}/${adminTestFileId}-admin-fixture.ext
├─ Pre-check file exists: [true/false]
├─ admin_users table state: [before/after insert/after delete]
├─ is_admin result: [true/false]
├─ Download HTTP: [200/403/other]
├─ Download error: [null / error message]
├─ Post-check file exists: [true/false]
└─ Result: [PASS/FAIL]
`);
```

---

## Part 4: File Existence Verification

### For STG-08, STG-15 (Source Preservation)

```javascript
// After failed move operation
console.log('\n📋 STG-08: Verify source file preserved after failed move');

const sourceExists = await clientA.storage.from('profile-images')
  .download(`${userIds['TEST_EXPERT_A']}/${userTestFileId}-test-file.png`);

if (!sourceExists.error) {
  console.log('✅ Source file still exists after failed move');
  result = 'PASS';
} else {
  console.log('❌ Source file missing after failed move');
  result = 'FAIL';
}

// Same for STG-15 (evidence-files)
```

---

## Part 5: RLS Failure Verification

### RLS Denial Checklist (All 4 conditions required)

**Template for each DENY test**:

```javascript
// Step 1: Verify file exists (owner can access)
const ownerCheck = await clientA.storage.from(bucket)
  .download(filePath);
console.log('1. File exists (owner check):', !ownerCheck.error);

// Step 2: Attempt unauthorized access
const deniedCheck = await testClient.storage.from(bucket)
  .download(filePath);
console.log('2. Access denied (test):', deniedCheck.error !== null);

// Step 3: Verify file still exists (owner can still access)
const ownerCheckAfter = await clientA.storage.from(bucket)
  .download(filePath);
console.log('3. File exists (owner post-check):', !ownerCheckAfter.error);

// Step 4: Verify error is security-related, not "file not found"
console.log('4. Error is RLS policy (not object not found):', 
  deniedCheck.error?.message?.includes('policy'));

// Result
const allConditionsMet = !ownerCheck.error && deniedCheck.error && 
  !ownerCheckAfter.error && deniedCheck.error?.message?.includes('policy');
result = allConditionsMet ? 'PASS' : 'FAIL';
```

---

## Part 6: Test Sequence Order

**Recommended execution order**:

1. **Setup phase**
   - Create users and sessions
   - Create admin fixtures
   - Verify fixtures exist

2. **User isolation tests** (STG-01~16)
   - Use userTestFileId
   - Verify RLS controls access

3. **Admin tests** (STG-17~22)
   - Use adminTestFileId (separate fixtures)
   - Test is_admin at each state
   - Verify file persistence

4. **Move tests** (STG-06, STG-14)
   - Verify source preservation
   - Confirm RLS blocks path change

5. **Cleanup phase**
   - Delete admin fixtures
   - Delete test users
   - Verify cleanup

---

## Part 7: Error Handling

### Do NOT treat as RLS success:
```
✗ "Object not found" (file doesn't exist)
✗ "Bucket not found" (wrong bucket)
✗ "Authentication required" (wrong session)
✗ "Script error" (code error)
```

### DO treat as RLS success:
```
✓ "new row violates row-level security policy"
✓ "permission denied" (RLS enforcement)
✓ 403 Forbidden with policy error
```

---

## Implementation Checklist

- [ ] Fix Move test variable initialization (Part 1)
- [ ] Create separate admin fixtures (Part 2)
- [ ] Add enhanced logging (Part 3)
- [ ] Add file existence checks (Part 4)
- [ ] Implement RLS verification checklist (Part 5)
- [ ] Execute tests in correct order (Part 6)
- [ ] Use correct error judgments (Part 7)

---

## Testing

After implementation:

```bash
node scripts/m2-storage-verification/dynamic-test.mjs
```

**Expected output**:
- No 500 errors
- Admin fixtures persist through tests
- Clear PASS/FAIL for each STG-01~22
- File existence pre/post checks

---

**This completes Parts 3-5 of CTO Reverification**

**Next**: Re-run tests and submit verified results
