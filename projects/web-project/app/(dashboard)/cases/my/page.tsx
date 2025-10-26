'use client';

import InsuranceCasesPage from '@/components/cases/insurance';
import WorkInjuryCasesPage from '@/components/cases/work-injury';
import { useSessionStore } from '@/lib/stores/session-store';
import React from 'react';

interface CaseManagementPageProps {
  department?: 'insurance' | 'work_injury';
}

export default function CaseManagementPage(props: CaseManagementPageProps) {
  const { department } = props;
  const currentUser = useSessionStore((state) => state.user);
  return (currentUser?.department || department) === 'work_injury' ? <WorkInjuryCasesPage /> : <InsuranceCasesPage />;
}