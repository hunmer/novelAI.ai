'use client';

import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { OnlineUser } from '@/components/project/online-users';

interface ProjectHeaderProps {
  projectName: string;
  onlineUsers: OnlineUser[];
  isConnected: boolean;
}

/**
 * 项目页面头部组件
 * 左上角：返回项目列表按钮
 * 中间：项目名称
 * 右上角：在线用户显示
 */
export function ProjectHeader({ projectName, onlineUsers, isConnected }: ProjectHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Button>
          <h1 className="text-xl font-semibold">{projectName}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">在线</span>
            <Badge variant="secondary">{onlineUsers.length}</Badge>
          </div>
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-xs">
            {isConnected ? '已连接' : '未连接'}
          </Badge>
          {onlineUsers.length > 0 && (
            <div className="flex items-center gap-1">
              {onlineUsers.slice(0, 3).map((user, index) => (
                <div
                  key={`${user.userId}-${index}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs"
                  title={user.userName}
                >
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="max-w-[80px] truncate">{user.userName}</span>
                </div>
              ))}
              {onlineUsers.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{onlineUsers.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
