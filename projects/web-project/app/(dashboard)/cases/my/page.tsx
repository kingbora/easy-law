'use client';

import CasesPage from '@/components/cases';
import { useCurrentUser } from '@/lib/stores/session-store';
import { useSearchParams } from 'next/navigation';
import React from 'react';

export default function CaseManagementPage() {
  const currentUser = useCurrentUser();
  const searchParams = useSearchParams();
  const department = currentUser?.department ?? null;
  if (!department) {
    return <div>无法确定您的部门，请联系管理员。</div>;
  }
  const caseId = searchParams.get('caseId');
  return <CasesPage department={department} initialCaseId={caseId} />;
}