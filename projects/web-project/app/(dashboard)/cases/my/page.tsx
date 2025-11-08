'use client';

import CasesPage from '@/components/cases';
import { useSessionStore } from '@/lib/stores/session-store';
import React from 'react';

export default function CaseManagementPage() {
  const currentUser = useSessionStore((state) => state.user);
  const department = currentUser?.department ?? null;
  if (!department) {
    return <div>无法确定您的部门，请联系管理员。</div>;
  }
  return <CasesPage department={department} />;
}