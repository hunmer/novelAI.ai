'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { PromptList } from './prompt-list';

interface PromptManagementProps {
  projectId: string;
}

export function PromptManagement({ projectId }: PromptManagementProps) {
  const [activeTab, setActiveTab] = useState<'world' | 'character'>('world');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">提示词管理</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'world' | 'character')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="world">世界观提示词</TabsTrigger>
          <TabsTrigger value="character">角色提示词</TabsTrigger>
        </TabsList>

        <TabsContent value="world" className="mt-6">
          <Card className="p-6">
            <PromptList projectId={projectId} type="world" />
          </Card>
        </TabsContent>

        <TabsContent value="character" className="mt-6">
          <Card className="p-6">
            <PromptList projectId={projectId} type="character" />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
