'use client';

import { useMemo } from 'react';
import { ProjectHeader } from './project-header';
import { useSocket } from '@/lib/socket/client';
import type { ProjectDialogProject } from '@/components/project/create-project-dialog';

interface ProjectHeaderWrapperProps {
  project: ProjectDialogProject;
}

/**
 * 项目头部包装组件 - 处理Socket连接和在线用户状态
 */
export function ProjectHeaderWrapper({ project }: ProjectHeaderWrapperProps) {
  // 生成稳定的用户ID
  const userId = useMemo(
    () => 'demo-user-' + Math.random().toString(36).substring(7),
    []
  );

  // Socket.IO实时协作
  const { isConnected, onlineUsers } = useSocket(project.id, userId, '访客用户');

  return (
    <ProjectHeader
      project={project}
      onlineUsers={onlineUsers}
      isConnected={isConnected}
    />
  );
}
