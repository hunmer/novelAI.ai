import type { Metadata } from 'next';
import './globals.css';
import 'reactflow/dist/style.css';
import { LoggerWidget } from '@/components/logger/logger-widget';

export const metadata: Metadata = {
  title: 'Novel.AI - AI辅助小说创作平台',
  description: '基于AI的小说生成与创作平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <LoggerWidget />
      </body>
    </html>
  );
}
