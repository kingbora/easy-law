'use client';

import InsuranceCasesPage from '@/components/cases/insurance';
import WorkInjuryCasesPage from '@/components/cases/work-injury';
import { useSessionStore } from '@/lib/stores/session-store';
import React from 'react';

export default function CaseManagementPage() {
  const currentUser = useSessionStore((state) => state.user);
  const department = currentUser?.department ?? null;
  return department === 'insurance' ? <InsuranceCasesPage /> : <WorkInjuryCasesPage />;
}