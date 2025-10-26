'use client';

import InsuranceCasesPage from "@/components/cases/insurance";
import WorkInjuryCasesPage from "@/components/cases/work-injury";

export default function CaseManagementPage({ params }: { params: { department: 'insurance' | 'work_injury' } }) {
  return params.department === 'work_injury' ? <WorkInjuryCasesPage /> : <InsuranceCasesPage />;
}