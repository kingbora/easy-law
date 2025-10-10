import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import 'antd/dist/reset.css';
import './globals.scss';

export const metadata: Metadata = {
  title: 'Easy Law Web',
  description: 'A lightweight starter interface for Easy Law.'
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
