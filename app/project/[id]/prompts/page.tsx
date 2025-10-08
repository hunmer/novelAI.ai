import { ProjectHeaderWrapper } from '@/components/project/project-header-wrapper';
import { PromptManagement } from '@/components/prompts/prompt-management';
import { getProjectById } from '@/lib/actions/project.actions';
import { notFound } from 'next/navigation';
import { parseProjectTags } from '@/lib/utils/project';

interface PromptsPageProps {
  params: {
    id: string;
  };
}

export default async function PromptsPage({ params }: PromptsPageProps) {
  const { id } = params;
  const project = await getProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeaderWrapper
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          author: project.author,
          coverImage: project.coverImage,
          tags: parseProjectTags(project.tags),
        }}
      />
      <main className="container mx-auto py-6">
        <PromptManagement projectId={id} />
      </main>
    </div>
  );
}
