import { DraftLegalBanner } from '@/components/DraftLegalBanner'
import { LegalDocument } from './LegalDocument'
import { privacySections } from '@/lib/legal/documents'

export function PrivacyContent() {
  return (
    <>
      <DraftLegalBanner />
      <LegalDocument sections={privacySections} />
    </>
  )
}
