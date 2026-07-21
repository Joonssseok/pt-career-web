# CTO Remote State Verification Instructions

**Purpose**: Establish baseline remote database state before reverification

**Environment**: Supabase Remote (linked)

**Executed By**: CTO (requires database access)

---

## Step 1: Git and Local Migration Status

### Command 1

```bash
supabase migration list --linked
```

**Record**:
```
Local migration head: [VERSION]
Remote migration head: [VERSION]
Pending migrations: [COUNT or LIST]
20260720000200 remote applied: YES/NO
```

### Command 2

```bash
git log -1 --oneline
```

**Record**:
```
Current commit: [HASH]
Commit message: [MESSAGE]
Date: [DATE]
```

---

## Step 2: Storage Policies Remote State

### Query 1: All Storage Policies

```sql
SELECT
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
```

**Expected Columns**:
- policyname: Policy identifier
- roles: Roles this policy applies to (e.g., {authenticated}, {anon})
- cmd: Operation (SELECT, INSERT, UPDATE, DELETE, ALL)
- qual: USING clause (selection condition)
- with_check: WITH CHECK clause (modification condition)

**Record in Report**:
```
Policy Count: [TOTAL]
Profiles by Operation:
- SELECT: [COUNT]
- INSERT: [COUNT]
- UPDATE: [COUNT]
- DELETE: [COUNT]
- ALL: [COUNT]

Policies by Bucket:
- profile-images: [LIST of policynames]
- evidence-files: [LIST of policynames]

Current Policy Names:
[Full list]
```

### Query 2: is_admin Function Definition

```sql
SELECT pg_get_functiondef(
  'public.is_admin(uuid)'::regprocedure
);
```

**Record in Report**:
```
Current is_admin definition:
[FULL FUNCTION CODE]

Function signature:
public.is_admin(uuid) RETURNS boolean

Security properties:
- DEFINER: [YES/NO]
- SECURITY: [INVOKER/DEFINER]
- STABLE/IMMUTABLE: [TYPE]
```

---

## Step 3: is_admin Function Runtime Test

**Prerequisite**: TEST_ADMIN user must exist (see Part 4 of verification)

### Query 3: is_admin Before admin_users Entry

```sql
SELECT public.is_admin('[TEST_ADMIN_UUID]'::uuid) as admin_check;
```

**Expected**: false (not in admin_users)

**Record**:
```
TEST_ADMIN_UUID: [REDACTED_UUID]
Condition: admin_users NOT contains TEST_ADMIN
Query result: [false/true]
Status: [PASS/FAIL]
```

### Query 4: is_admin After admin_users Entry

**First insert TEST_ADMIN into admin_users**:
```sql
INSERT INTO admin_users (user_id, role, created_by)
VALUES ('[TEST_ADMIN_UUID]'::uuid, 'super_admin', '[TEST_ADMIN_UUID]'::uuid)
ON CONFLICT DO NOTHING;
```

**Then check is_admin**:
```sql
SELECT public.is_admin('[TEST_ADMIN_UUID]'::uuid) as admin_check;
```

**Expected**: true (in admin_users)

**Record**:
```
admin_users insert status: [SUCCESS/FAIL]
Query result: [true/false]
Status: [PASS/FAIL]
```

### Query 5: is_admin After admin_users Removal

**First remove TEST_ADMIN from admin_users**:
```sql
DELETE FROM admin_users 
WHERE user_id = '[TEST_ADMIN_UUID]'::uuid;
```

**Then check is_admin**:
```sql
SELECT public.is_admin('[TEST_ADMIN_UUID]'::uuid) as admin_check;
```

**Expected**: false (no longer in admin_users)

**Record**:
```
admin_users delete status: [SUCCESS/FAIL]
Query result: [false/true]
Status: [PASS/FAIL]
```

---

## Step 4: admin_users Table Current State

### Query 6: Current admin_users Entries

```sql
SELECT user_id, role, created_by, created_at
FROM admin_users
ORDER BY created_at DESC
LIMIT 10;
```

**Record**:
```
Total entries: [COUNT]
Recent entries:
[TABLE RESULTS with UUIDs masked]
```

---

## Summary Template

**Insert into CTO report**:

```
REMOTE DATABASE STATE (Verified [DATE])

Local Migration Status:
  Local head: 20260720000200
  Remote head: [VERIFIED_VERSION]
  Pending: [COUNT or NONE]
  20260720000200 applied: [YES/NO]

Storage Policies:
  Total: [COUNT]
  Profile-Images: [COUNT + names]
  Evidence-Files: [COUNT + names]
  
is_admin Function:
  Definition: [SUMMARY]
  SECURITY DEFINER: [YES/NO]
  Current behavior:
    - Before admin_users: [TRUE/FALSE]
    - After admin_users: [TRUE/FALSE]
    - After removal: [TRUE/FALSE]

admin_users Table:
  Current entries: [COUNT]
  TEST_ADMIN present: [YES/NO]

Assessment:
  Migration status: [APPLIED/NOT APPLIED/PARTIAL]
  Policy status: [EXPECTED/UNEXPECTED]
  Function status: [WORKING/NOT WORKING]
```

---

## Notes

- All UUIDs in final report must be [REDACTED]
- Do not modify database during queries (read-only)
- If any query fails, record the error message
- Timestamp all results
- Keep this template for audit trail

---

**This completes Part 1 of CTO Reverification**

**Next**: Submit results for analysis before proceeding to Parts 2-8
