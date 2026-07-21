# M2 Local Clean Rebuild - Automated Script
# Purpose: Stop Supabase, restart it, and reset database with all migrations

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "M2 Local Clean Rebuild - Starting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Supabase
Write-Host "[1/3] Stopping Supabase (removing all local data)..." -ForegroundColor Yellow
supabase stop --no-backup
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to stop Supabase" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Supabase stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Start Supabase
Write-Host "[2/3] Starting Supabase..." -ForegroundColor Yellow
supabase start
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start Supabase" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Supabase started" -ForegroundColor Green
Write-Host ""

# Step 3: Reset Database (apply all migrations)
Write-Host "[3/3] Resetting database and applying migrations..." -ForegroundColor Yellow
Write-Host "This will create all tables, functions, and policies from scratch..." -ForegroundColor Gray
Write-Host ""

supabase db reset

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to reset database" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Local Clean Rebuild COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "All migrations have been applied:" -ForegroundColor Cyan
Write-Host "  • 20260719000000_m2_init.sql" -ForegroundColor Cyan
Write-Host "  • 20260721000000_m2_finalize_storage_policy_alignment.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Expected final state:" -ForegroundColor Cyan
Write-Host "  ✓ 5 base tables created" -ForegroundColor Cyan
Write-Host "  ✓ 12 specialties inserted" -ForegroundColor Cyan
Write-Host "  ✓ is_admin() function created" -ForegroundColor Cyan
Write-Host "  ✓ 12 storage policies created" -ForegroundColor Cyan
Write-Host "  ✓ license_requests_view created" -ForegroundColor Cyan
Write-Host ""
