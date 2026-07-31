import { Suspense } from 'react';
import EditForm from './EditForm';
import { EvidenceFileArchive } from '@/components/EvidenceFileArchive';

export default function ProfileEditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <EditForm evidenceArchive={<EvidenceFileArchive />} />
    </Suspense>
  );
}
