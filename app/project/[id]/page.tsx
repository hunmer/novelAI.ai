import { getProjectById } from '@/lib/actions/project.actions';
import { WorldEditor } from '@/components/editors/world-editor';
import { CharacterEditor } from '@/components/editors/character-editor';
import { SceneEditor } from '@/components/editors/scene-editor';
import { ProjectHeaderWrapper } from '@/components/project/project-header-wrapper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KnowledgeBaseTab } from '@/components/project/knowledge-base-tab';
import { CharacterChatTab } from '@/components/project/character-chat-tab';
import { PlotTab } from '@/components/project/plot-tab';
import { parseProjectTags } from '@/lib/utils/project';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(id);

  if (!project) {
    return <div>项目不存在</div>;
  }

  return (
    <>
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
      <div className="container py-6">
        <Tabs defaultValue="world">
          <TabsList className="mb-6">
            <TabsTrigger value="world">世界观</TabsTrigger>
            <TabsTrigger value="characters">角色</TabsTrigger>
            <TabsTrigger value="chat">角色对话</TabsTrigger>
            <TabsTrigger value="scenes">场景</TabsTrigger>
            <TabsTrigger value="plot">剧情</TabsTrigger>
            <TabsTrigger value="knowledge">知识库</TabsTrigger>
          </TabsList>
          <TabsContent value="world">
            <WorldEditor projectId={project.id} initialWorld={project.world || ''} />
          </TabsContent>
          <TabsContent value="characters">
            <CharacterEditor projectId={project.id} worldContext={project.world || ''} />
          </TabsContent>
          <TabsContent value="chat">
            <CharacterChatTab projectId={project.id} />
          </TabsContent>
          <TabsContent value="scenes">
            <SceneEditor projectId={project.id} worldContext={project.world || ''} />
          </TabsContent>
          <TabsContent value="plot">
            <PlotTab projectId={project.id} />
          </TabsContent>
          <TabsContent value="knowledge">
            <KnowledgeBaseTab projectId={project.id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
