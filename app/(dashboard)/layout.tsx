import { ProjectSidebar } from '@/components/project/project-sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen">
      <ProjectSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
