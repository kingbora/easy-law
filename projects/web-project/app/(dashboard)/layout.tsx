import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import DashboardLayoutClient from './layout.client';
import { fetchCurrentUserServer } from '@/lib/users-server';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const currentUser = await fetchCurrentUserServer();

  if (!currentUser) {
    redirect('/login');
  }

  return (
    <DashboardLayoutClient initialUser={currentUser}>
      {children}
    </DashboardLayoutClient>
  );
}
