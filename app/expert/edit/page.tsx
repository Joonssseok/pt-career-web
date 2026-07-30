import { Suspense } from 'react';
import EditForm from './EditForm';

export default function ProfileEditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <EditForm />
    </Suspense>
  );
}
