# Changelog - PT Career Web

모든 주목할 만한 변경사항이 이 파일에 기록됩니다.

**마지막 갱신:** 2026-07-16

---

## [Unreleased]

### Phase New-0 (진행 중)
**Status:** Repository creation and document migration

#### Added
- New GitHub repository: pt-career-web
- Clean Next.js baseline structure (preparation)
- Decision log (10_DECISION_LOG.md)
- Repository context documentation

#### Removed
- Vite build configuration
- Express server code
- Manus OAuth integration
- Manus Forge API integration
- Render deployment config

#### Documentation
- docs/10_DECISION_LOG.md — Repository transition decision
- docs/13_UX_FLOW.md — Existing UX flows (preserved from legacy)
- docs/MVP_MIGRATION_LOG.md — Previous migration record

---

## [Legacy Archive]

### Previous: Joonssseok/pt-career

**Status:** Archived  
**Commits:** 3483c1c and earlier  
**Purpose:** Legacy code reference (do not use for new features)

#### Phase 0 (Completed)
- Legacy code preservation
- GitHub Actions disabled

#### Phase 1 (Attempted)
- Next.js base structure created
- Build verification passed
- Vercel deployment failed (404 persists)

#### Phase 1-B (Analysis)
- Root causes identified: branch mismatch, Vercel settings
- Solution: New repository with clean baseline

---

## Migration Notes

### From Joonssseok/pt-career to pt-career-web

**Do Not Copy:**
- ❌ Vite/Express/Render stack
- ❌ Manus OAuth/Forge integration
- ❌ Drizzle MySQL schema
- ❌ Old GitHub Pages workflow

**Selectively Copy:**
- ✅ UI component designs
- ✅ Tailwind design tokens
- ✅ Utility functions (distance calculation)
- ✅ UX documentation
- ✅ Database design principles

---

## Version Strategy

New repository uses:
- `main` as primary branch (no master)
- `feature/phase-*` for feature work
- Semantic versioning for releases

---

**Start Date:** 2026-07-16  
**Repository:** https://github.com/Joonssseok/pt-career-web  
**Status:** Active Development
