import { getProjectById } from '@/lib/actions/project.actions';
import { WorldEditor } from '@/components/editors/world-editor';
import { CharacterEditor } from '@/components/editors/character-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProjectById(params.id);

  if (!project) {
    return <div>项目不存在</div>;
  }

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">{project.name}</h1>
      <Tabs defaultValue="world">
        <TabsList>
          <TabsTrigger value="world">世界观</TabsTrigger>
          <TabsTrigger value="characters">角色</TabsTrigger>
        </TabsList>
        <TabsContent value="world">
          <WorldEditor projectId={project.id} initialWorld={project.world || ''} />
        </TabsContent>
        <TabsContent value="characters">
          <CharacterEditor projectId={project.id} worldContext={project.world || ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
