'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { PromptList } from './prompt-list';

interface PromptManagementProps {
  projectId: string;
}

export function PromptManagement({ projectId }: PromptManagementProps) {
  const [activeTab, setActiveTab] = useState<'world' | 'character' | 'scene' | 'dialog'>('world');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'world' | 'character' | 'scene' | 'dialog')}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="world">世界观</TabsTrigger>
          <TabsTrigger value="character">角色</TabsTrigger>
          <TabsTrigger value="scene">场景</TabsTrigger>
          <TabsTrigger value="dialog">对话</TabsTrigger>
        </TabsList>

        <TabsContent value="world" className="mt-4">
          <Card className="p-6">
            <PromptList projectId={projectId} type="world" />
          </Card>
        </TabsContent>

        <TabsContent value="character" className="mt-4">
          <Card className="p-6">
            <PromptList projectId={projectId} type="character" />
          </Card>
        </TabsContent>

        <TabsContent value="scene" className="mt-4">
          <Card className="p-6">
            <PromptList projectId={projectId} type="scene" />
          </Card>
        </TabsContent>

        <TabsContent value="dialog" className="mt-4">
          <Card className="p-6">
            <PromptList projectId={projectId} type="dialog" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
