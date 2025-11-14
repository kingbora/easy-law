'use client';

import CasesPage from "@/components/cases";
import type { UserDepartment } from "@/lib/users-api";

export default function CaseManagementPage({ params }: { params: { department: UserDepartment } }) {
  if (!params.department) {
    return <div>无法确定部门，请联系管理员。</div>;
  }
  return <CasesPage department={params.department} />;
}