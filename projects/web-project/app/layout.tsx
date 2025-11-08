import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import 'antd/dist/reset.css';
import './globals.scss';
import { App } from 'antd';

export const metadata: Metadata = {
  title: '简法 - 智能律所管理平台，让法律工作更简单',
  description: '简法致力于为律所提供安全可靠的一站式数字化解决方案。涵盖从案源开拓、项目承办到财务核算的全生命周期管理，严格遵循律师职业道德规范，保障客户数据隐私与信息安全，是值得信赖的律所运营伙伴。',
  keywords: ['律所管理软件', '法律办公系统', '律师CRM', '案件管理系统', '法律计时收费', '简法', '法律科技', '律所SaaS'],
  icons: {
    icon: `${process.env.__NEXT_ROUTER_BASEPATH}/images/favicon.ico`,
    shortcut: `${process.env.__NEXT_ROUTER_BASEPATH}/images/favicon.ico`,
    apple: `${process.env.__NEXT_ROUTER_BASEPATH}/images/favicon.ico`,
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <App>{children}</App>
        </AntdRegistry>
      </body>
    </html>
  );
}
