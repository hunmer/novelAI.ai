'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ProjectTabs() {
  return (
    <Tabs defaultValue="world" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none">
        <TabsTrigger value="world">世界观</TabsTrigger>
        <TabsTrigger value="characters">角色</TabsTrigger>
        <TabsTrigger value="scenes">场景</TabsTrigger>
        <TabsTrigger value="dialogs">对话</TabsTrigger>
        <TabsTrigger value="assets">美术</TabsTrigger>
      </TabsList>
      <TabsContent value="world">世界观内容</TabsContent>
      <TabsContent value="characters">角色内容</TabsContent>
      <TabsContent value="scenes">场景内容</TabsContent>
      <TabsContent value="dialogs">对话内容</TabsContent>
      <TabsContent value="assets">美术内容</TabsContent>
    </Tabs>
  );
}
