'use client';

import CasesPage from "@/components/cases";
import type { UserDepartment } from "@easy-law/shared-types";
import { useSearchParams } from "next/navigation";

export default function CaseManagementPage({ params }: { params: { department: UserDepartment } }) {
  const searchParams = useSearchParams();
  if (!params.department) {
    return <div>无法确定部门，请联系管理员。</div>;
  }
  const caseId = searchParams?.get('caseId');
  return <CasesPage department={params.department} initialCaseId={caseId} />;
}