import { getProjects } from '@/lib/actions/project.actions';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export async function ProjectList() {
  const projects = await getProjects();

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>暂无项目,点击左上角 + 创建新项目</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <Link key={project.id} href={`/project/${project.id}`}>
          <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
            <h3 className="font-semibold text-lg">{project.name}</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {project.description || '暂无描述'}
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              创建于 {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
