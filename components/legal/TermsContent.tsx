import { DraftLegalBanner } from '@/components/DraftLegalBanner'
import { LegalDocument } from './LegalDocument'
import { termsSections } from '@/lib/legal/documents'

export function TermsContent() {
  return (
    <>
      <DraftLegalBanner />
      <LegalDocument sections={termsSections} />
    </>
  )
}
