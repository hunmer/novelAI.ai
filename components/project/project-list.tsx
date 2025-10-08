import { getProjects } from '@/lib/actions/project.actions';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { parseProjectTags } from '@/lib/utils/project';

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
      {projects.map((project) => {
        const tags = parseProjectTags(project.tags);
        return (
          <Link key={project.id} href={`/project/${project.id}`}>
            <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
              <div className="h-40 w-full overflow-hidden bg-muted">
                {project.coverImage ? (
                  <Image
                    src={project.coverImage}
                    alt={`${project.name} 封面`}
                    width={320}
                    height={160}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    暂无封面
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-lg font-semibold">{project.name}</h3>
                {project.author && (
                  <p className="mt-1 text-sm text-muted-foreground">作者：{project.author}</p>
                )}
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {project.description || '暂无描述'}
                </p>
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-auto pt-4 text-xs text-muted-foreground">
                  创建于 {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
