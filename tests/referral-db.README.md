# Referral event database checks

Only operator-issued event codes are supported. There are no member invite codes,
referrer identities, expiry dates, usage limits, coupons, rewards or payment rights.

## SQL handoff

`supabase/migrations/20261118075047_referral_event_codes.sql` was generated with the installed CLI after checking its help. It is the single source for deployment and local tests.
Keep `referral_private` outside the Data API's exposed schemas, as with `pin_private`.
This isolated test runner does not contact or change any hosted database. The approved production migration and read-only verification are recorded separately in docs/report/REFERRAL_EVENT_CODES_2026-11-18.md.

The five public RPCs are security invokers. Their private implementations are
security definers with empty search paths and explicit `auth.uid()` ownership
checks. Authenticated users have schema usage and execute on only the five private
entry points, with no table access. The internal membership/lock helper is not
granted to callers. Both tables have RLS with no permissive policies.

## RPC contract

- `own_referral_status()` returns `{registeredCode, registeredAt}` with nulls before
  registration. Unauthenticated or inactive callers receive SQLSTATE `42501`
  with controlled message `not_authenticated` or `unavailable`.
- `register_referral_code(input_code text)` returns `{ok:true}` or
  `{ok:false,error}`. Codes are trimmed and uppercased before validation.
  Errors are `not_authenticated`, `unavailable`, `invalid_code`, or
  `already_registered`. Unknown and disabled campaigns share `unavailable`.
  After own-account eligibility checks, same-code retries succeed even if that
  campaign was later disabled, preserving the original timestamp. A different
  well-formed code always returns `already_registered` after a registration exists.
- `list_referral_campaigns()` returns a JSON array of
  `{code,label,active,createdAt,registrations}`. Non-admins receive SQLSTATE `42501`
  with controlled message `not_allowed`. Membership errors match the status RPC.
- `create_referral_campaign(input_code text,input_label text)` returns `{ok:true}`
  or `{ok:false,error}`. Additional errors are `not_allowed`, `duplicate_code`,
  `invalid_label`. Labels are trimmed and must have 1–80 characters. New campaigns
  are active. Codes must match `[A-Z0-9][A-Z0-9_-]{3,31}` after normalization.
- `set_referral_campaign_active(input_code text,input_active boolean)` returns
  `{ok:true}` or `{ok:false,error}`. Errors are `not_authenticated`, `unavailable`,
  `not_allowed`, `invalid_code`. Missing campaigns and null activity use `unavailable`.

All admin RPCs check the existing `public.is_admin()` protected database lookup.
Metadata grants no rights. Eligibility requires an existing, non-anonymous Auth
user with confirmed email or phone, no current Auth ban, and no suspended or
deletion-pending profile. A profile is optional. All entry points lock the member's
Auth row with `FOR UPDATE`, serializing registration for that account. Campaign
registration also takes a shared campaign row lock against activation changes.

`docs/report/REFERRAL_ROLLBACK_DISABLE.sql` revokes access through both public and
private paths without deleting or modifying data. It is also executed locally by
the tests, which compare data snapshots before and after it.

## Reproduce locally

Install the pinned test engine outside the repository; this does not alter the
application package manifest or lockfile. In PowerShell:

```powershell
$referralEngine = Join-Path $env:TEMP 'referral-db-pglite'
npm install --prefix $referralEngine --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
$env:REFERRAL_PGLITE_ROOT = $referralEngine
node --test tests/referral-db.mjs
```

If installation and execution use different temporary directories, set
`REFERRAL_PGLITE_ROOT` to the actual installation directory before execution.
The runner never reads `.env` files, credentials or network database addresses.

Validated: 14 focused subtests plus their enclosing Node test (15 passing, zero
failures). Tests execute the complete migration and rollback against a new in-memory
Postgres engine, with synthetic Auth/users, roles, profiles and protected admin
membership. Coverage includes unauthenticated callers, unconfirmed/anonymous users,
inactive accounts, stale deleted subjects, owner isolation, direct table denials,
RLS under an accidental SELECT grant, metadata spoofing, admin revocation, input
validation, disabled/unknown codes, idempotency, overwrite prevention, primary/FK
constraints, transaction rollback, deletion cascade and permission rollback.

Limitations: minimal fixture schema rather than all application migrations; no
hosted Supabase advisors, PostgREST routing or full Supabase stack verification.
PGlite is single-connection: the lock is inspected and sequential overwrite behavior
is executed, but multi-session contention/deadlocks are not tested. Validate those
on an isolated real Postgres instance before release. No production SQL was applied.
