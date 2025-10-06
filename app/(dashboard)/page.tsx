import { ProjectList } from '@/components/project/project-list';
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">我的项目</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <ProjectList />
      </Suspense>
    </div>
  );
}
