'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat, useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, MessageCircle, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImportSettingsDialog } from '@/components/dialogs/import-settings-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logger } from '@/lib/logger/client';

interface KnowledgeEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface KnowledgeBaseTabProps {
  projectId: string;
}

interface KnowledgeChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface KnowledgeChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function KnowledgeBaseTab({ projectId }: KnowledgeBaseTabProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<Record<string, unknown>>({});
  const [chatInput, setChatInput] = useState('');
  const [sessions, setSessions] = useState<KnowledgeChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const persistedMessageIdsRef = useRef<Set<string>>(new Set());
  const previousMessageIdsRef = useRef<string[]>([]);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/projects/${projectId}/knowledge/chat`,
      }),
    [projectId]
  );

  const chat = useMemo(
    () =>
      new Chat({
        id: `project-${projectId}-knowledge`,
        transport: chatTransport,
        messages: [],
      }),
    [chatTransport, projectId]
  );

  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error: chatError,
    setMessages,
    clearError,
  } = useChat({
    chat,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true);
    setEntriesError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/knowledge`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '知识库加载失败');
      }
      setEntries(data.entries || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : '知识库加载失败';
      setEntriesError(message);
    } finally {
      setLoadingEntries(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const extractTextFromMessage = useCallback((message: unknown): string => {
    const candidate = message as {
      parts?: Array<{ type?: string; text?: string }>;
      content?: unknown;
    };

    let textContent =
      candidate.parts
        ?.map((part) => (part?.type === 'text' ? part.text ?? '' : ''))
        .filter(Boolean)
        .join('\n') ?? '';

    if (!textContent) {
      if (typeof candidate.content === 'string') {
        textContent = candidate.content;
      } else if (Array.isArray(candidate.content)) {
        textContent = candidate.content
          .map((item) =>
            item && typeof item === 'object' && 'type' in item && item.type === 'text'
              ? ((item as { text?: string }).text ?? '')
              : ''
          )
          .filter(Boolean)
          .join('\n');
      }
    }

    return textContent;
  }, []);

  const isMessageComplete = useCallback((message: { role: string; parts?: unknown }): boolean => {
    if (message.role !== 'assistant') {
      return true;
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];

    return parts.every((part) => {
      if (!part || typeof part !== 'object') {
        return true;
      }

      const typed = part as { type?: string; state?: string };

      if (typed.type === 'text' || typed.type === 'reasoning') {
        return typed.state === undefined || typed.state === 'done';
      }

      if (typed.type === 'dynamic-tool') {
        return typed.state !== 'input-streaming';
      }

      if (typeof typed.type === 'string' && typed.type.startsWith('tool-')) {
        return typed.state !== 'input-streaming';
      }

      return true;
    });
  }, []);

  const shouldPersistMessage = useCallback((message: { role: string }) => {
    return message.role === 'user' || message.role === 'assistant';
  }, []);

  const persistMessages = useCallback(
    async (candidates: Array<{ id: string; role: string; parts?: unknown; content?: unknown }>) => {
      if (!activeSessionId) {
        return;
      }

      const payload = candidates
        .filter(
          (candidate) =>
            typeof candidate.id === 'string' &&
            candidate.id.length > 0 &&
            shouldPersistMessage(candidate)
        )
        .map((candidate) => ({
          id: candidate.id as string,
          role: candidate.role as 'user' | 'assistant',
          content: extractTextFromMessage(candidate).trim(),
        }))
        .filter((item) => item.content.length > 0);

      if (!payload.length) {
        return;
      }

      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge/chat/history/${activeSessionId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: payload }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error ?? '写入知识库对话消息失败');
        }

        payload.forEach((item) => {
          persistedMessageIdsRef.current.add(item.id);
        });

        setSessions((prev) => {
          if (!activeSessionId) return prev;

          const nowIso = new Date().toISOString();
          const updated = prev.map((session) =>
            session.id === activeSessionId
              ? { ...session, updatedAt: nowIso }
              : session
          );
          const current = updated.find((session) => session.id === activeSessionId);
          if (!current) {
            return updated;
          }
          return [current, ...updated.filter((session) => session.id !== activeSessionId)];
        });

        void logger.info('知识库对话消息已持久化', 'knowledge-chat', {
          projectId,
          sessionId: activeSessionId,
          messageIds: payload.map((item) => item.id),
        });
      } catch (error) {
        console.error('写入知识库对话消息失败', error);
        void logger.error('写入知识库对话消息失败', 'knowledge-chat', {
          projectId,
          sessionId: activeSessionId,
          messageIds: payload.map((item) => item.id),
        });
      }
    },
    [activeSessionId, extractTextFromMessage, projectId, setSessions, shouldPersistMessage]
  );

  useEffect(() => {
    if (!activeSessionId || messages.length === 0) {
      return;
    }

    const readyMessages = messages.filter((message) => {
      if (!shouldPersistMessage(message)) return false;
      if (persistedMessageIdsRef.current.has(message.id)) return false;
      if (!isMessageComplete(message)) return false;
      return extractTextFromMessage(message).trim().length > 0;
    });

    if (readyMessages.length === 0) {
      return;
    }

    void persistMessages(readyMessages);
  }, [
    messages,
    activeSessionId,
    extractTextFromMessage,
    isMessageComplete,
    persistMessages,
    shouldPersistMessage,
  ]);

  useEffect(() => {
    if (!activeSessionId) {
      previousMessageIdsRef.current = messages.map((message) => message.id);
      return;
    }

    const currentIds = messages.map((message) => message.id);
    const previousIds = previousMessageIdsRef.current;
    const newIds = currentIds.filter((id) => !previousIds.includes(id));

    if (newIds.length > 0) {
      const newMessages = messages.filter((message) => newIds.includes(message.id));

      void logger.info('知识库对话消息更新', 'knowledge-chat', {
        projectId,
        sessionId: activeSessionId,
        newMessageIds: newIds,
        roles: newMessages.map((message) => message.role),
      });
    }

    previousMessageIdsRef.current = currentIds;
  }, [messages, activeSessionId, projectId]);

  const handleStartNewSession = useCallback(
    async (title?: string) => {
      setCreatingSession(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/knowledge/chat/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(title ? { title } : {}),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error ?? '创建知识库对话会话失败');
        }

        const session = data?.session as KnowledgeChatSessionSummary | undefined;
        if (!session) {
          throw new Error('未返回有效的知识库对话会话');
        }

        setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
        setActiveSessionId(session.id);
        setMessages([]);
        setChatInput('');
        clearError();
        persistedMessageIdsRef.current = new Set();
        previousMessageIdsRef.current = [];

        void logger.info('开始新的知识库对话会话', 'knowledge-chat', {
          projectId,
          sessionId: session.id,
        });

        return session;
      } catch (error) {
        console.error('创建知识库对话会话失败', error);
        void logger.error('创建知识库对话会话失败', 'knowledge-chat', { projectId });
        throw error;
      } finally {
        setCreatingSession(false);
      }
    },
    [projectId, setMessages, clearError]
  );

  const ensureActiveSession = useCallback(async () => {
    if (activeSessionId) {
      return activeSessionId;
    }

    try {
      const session = await handleStartNewSession();
      return session?.id ?? null;
    } catch {
      return null;
    }
  }, [activeSessionId, handleStartNewSession]);

  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      setLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge/chat/history/${sessionId}/messages?limit=200`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error ?? '加载知识库对话消息失败');
        }

        const history = (data?.messages as KnowledgeChatHistoryMessage[] | undefined) ?? [];
        const restored = history.map((message) => ({
          id: message.id,
          role: message.role,
          parts: [
            {
              type: 'text',
              text: message.content,
              state: 'done',
            },
          ],
        }));

        setMessages(restored);
        persistedMessageIdsRef.current = new Set(restored.map((message) => message.id));
        previousMessageIdsRef.current = restored.map((message) => message.id);

        void logger.info('加载知识库对话历史', 'knowledge-chat', {
          projectId,
          sessionId,
          messageCount: restored.length,
        });
      } catch (error) {
        console.error('加载知识库对话消息失败', error);
        void logger.error('加载知识库对话消息失败', 'knowledge-chat', {
          projectId,
          sessionId,
        });
      } finally {
        setLoadingHistory(false);
      }
    },
    [projectId, setMessages]
  );

  useEffect(() => {
    let isMounted = true;

    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge/chat/history`
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error ?? '加载知识库会话失败');
        }

        const sessionList = (data?.sessions as KnowledgeChatSessionSummary[] | undefined) ?? [];

        if (!isMounted) {
          return;
        }

        setSessions(sessionList);

        const nextSessionId = sessionList.length
          ? sessionList[0].id
          : null;

        if (sessionList.length === 0) {
          await handleStartNewSession();
        } else {
          setActiveSessionId((current) => {
            if (current && sessionList.some((session) => session.id === current)) {
              return current;
            }
            return nextSessionId;
          });
        }
      } catch (error) {
        console.error('加载知识库会话失败', error);
        void logger.error('加载知识库会话失败', 'knowledge-chat', { projectId });
      } finally {
        if (isMounted) {
          setLoadingSessions(false);
        }
      }
    };

    void loadSessions();

    return () => {
      isMounted = false;
    };
  }, [projectId, handleStartNewSession]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    void loadSessionMessages(activeSessionId);
  }, [activeSessionId, loadSessionMessages]);

  const resetEditorState = () => {
    setEditingEntry(null);
    setContent('');
    setTitle('');
    setDraftMetadata({});
    setFormError(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetEditorState();
    }
  };

  const openCreateDialog = () => {
    resetEditorState();
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setTitle(typeof entry.metadata?.title === 'string' ? entry.metadata.title : '');
    setContent(entry.content);
    setDraftMetadata({ ...entry.metadata });
    setFormError(null);
    setIsDialogOpen(true);
  };

  const handleSubmitEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setFormError('请输入需要写入知识库的内容');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const baseMetadata = editingEntry ? { ...draftMetadata } : {};
      const trimmedTitle = title.trim();

      const metadataPayload = (() => {
        if (trimmedTitle) {
          return { ...baseMetadata, title: trimmedTitle };
        }

        if (editingEntry && 'title' in baseMetadata) {
          const { title: _removed, ...rest } = baseMetadata as Record<string, unknown> & {
            title?: unknown;
          };
          return Object.keys(rest).length ? rest : undefined;
        }

        return Object.keys(baseMetadata).length ? baseMetadata : undefined;
      })();

      const payload = editingEntry
        ? {
            entryId: editingEntry.id,
            content: trimmedContent,
            metadata: metadataPayload,
          }
        : {
            content: trimmedContent,
            metadata: metadataPayload,
          };

      const res = await fetch(`/api/projects/${projectId}/knowledge`, {
        method: editingEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || (editingEntry ? '更新失败' : '保存失败'));
      }

      await fetchEntries();
      handleDialogOpenChange(false);
    } catch (error) {
      const fallback = editingEntry ? '更新失败' : '保存失败';
      const message = error instanceof Error ? error.message : fallback;
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const confirmed = window.confirm('确定要删除该知识库片段吗？');
    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/knowledge?entryId=${entryId}`,
        {
          method: 'DELETE',
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '删除失败');
      }
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
    }
  };

  const formattedMessages = useMemo(() => {
    return messages
      .filter((message) => shouldPersistMessage(message))
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: extractTextFromMessage(message),
      }));
  }, [messages, extractTextFromMessage, shouldPersistMessage]);

  const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    try {
      const sessionId = await ensureActiveSession();
      if (!sessionId) {
        throw new Error('无法创建知识库对话会话');
      }

      await sendMessage(
        {
          role: 'user',
          parts: [{ type: 'text', text: trimmed }],
        },
        { body: { sessionId } }
      );
      setChatInput('');
      clearError();
    } catch (error) {
      console.error('发送聊天消息失败', error);
      void logger.error('发送知识库聊天消息失败', 'knowledge-chat', {
        projectId,
        sessionId: activeSessionId,
      });
    }
  };

  const handleClearConversation = () => {
    setChatInput('');
    clearError();
    void handleStartNewSession();
  };

  const handleRegenerate = () => {
    void (async () => {
      try {
        const sessionId = await ensureActiveSession();
        if (!sessionId) {
          throw new Error('无法创建知识库对话会话');
        }
        await regenerate({ body: { sessionId } });
      } catch (error) {
        console.error('重新生成知识库回复失败', error);
        void logger.error('重新生成知识库回复失败', 'knowledge-chat', {
          projectId,
          sessionId: activeSessionId,
        });
      }
    })();
  };

  const handleStop = () => {
    void stop();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
      <Card className="flex min-h-[600px] flex-col lg:max-h-[calc(100vh-160px)] lg:overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  增加片段
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={openCreateDialog}>
                  新建片段
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ImportSettingsDialog projectId={projectId} onImportComplete={fetchEntries} />
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEntry ? '编辑知识库片段' : '新建知识库片段'}</DialogTitle>
              <DialogDescription>
                填写片段标题与内容，提交后系统将生成检索向量。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="knowledge-title">
                  片段标题（可选）
                </label>
                <Input
                  id="knowledge-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：世界观设定-能源体系"
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="knowledge-content">
                  内容
                </label>
                <Textarea
                  id="knowledge-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="支持 Markdown，提交后自动生成 Embedding"
                  rows={6}
                  disabled={isSaving}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={isSaving}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingEntry ? '更新片段' : '保存片段'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loadingEntries && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在加载知识库…
            </div>
          )}

          {!loadingEntries && entriesError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {entriesError}
            </div>
          )}

          {!loadingEntries && !entriesError && entries.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              暂无知识库内容，先添加一个片段吧。
            </div>
          )}

          {!loadingEntries && !entriesError &&
            entries.map((entry) => {
              const createdAt = new Date(entry.createdAt);
              const titleFromMetadata =
                typeof entry.metadata?.title === 'string'
                  ? entry.metadata.title
                  : undefined;

              return (
                <div
                  key={entry.id}
                  className="group rounded-lg border bg-card/40 p-3 shadow-sm transition hover:border-primary/60"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {titleFromMetadata || '未命名片段'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {createdAt.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(entry)}
                        title="编辑片段"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(entry.id)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                    {entry.content}
                  </p>
                </div>
              );
            })}
        </div>
      </Card>

      <Card className="flex min-h-[600px] flex-col lg:max-h-[calc(100vh-160px)] lg:overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">知识库对话</h3>
            <p className="text-sm text-muted-foreground">
              {loadingSessions
                ? '正在加载历史记录…'
                : '对话记录会自动保存，可随时切换查看历史。'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={activeSessionId ?? undefined}
              onValueChange={(value) => {
                setActiveSessionId(value);
                setMessages([]);
                persistedMessageIdsRef.current = new Set();
                previousMessageIdsRef.current = [];
                clearError();
              }}
              disabled={loadingSessions || creatingSession || sessions.length === 0}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={loadingSessions ? '加载中…' : '选择历史对话'} />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => {
                  const timestamp = new Date(session.updatedAt);
                  const timeLabel = Number.isNaN(timestamp.getTime())
                    ? ''
                    : timestamp.toLocaleString();
                  return (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title}
                      {timeLabel ? ` · ${timeLabel}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleStartNewSession()}
              disabled={creatingSession}
            >
              {creatingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中…
                </>
              ) : (
                '新建对话'
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {loadingHistory && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载历史对话…
            </div>
          )}

          {formattedMessages.length === 0 && !isLoading && !loadingHistory && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8" />
              <p className="text-sm">开始提问，系统会自动检索相关知识片段。</p>
            </div>
          )}

          {formattedMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm shadow-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在检索知识片段并生成回复…
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleStop}
                  className="mt-3 h-7 px-2 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  停止
                </Button>
              </div>
            </div>
          )}

          {chatError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {chatError.message}
            </div>
          )}
        </div>

        <form
          ref={formRef}
          onSubmit={handleChatSubmit}
          className="space-y-3 border-t px-6 py-4"
        >
          <Textarea
            value={chatInput}
            onChange={(event) => {
              setChatInput(event.target.value);
              if (chatError) {
                clearError();
              }
            }}
            placeholder="向知识库提问，支持 Markdown 输出"
            rows={4}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearConversation}
                disabled={creatingSession}
              >
                清除对话
              </Button>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isLoading || creatingSession}
                  onClick={handleRegenerate}
                >
                  重新生成
                </Button>
              )}
            </div>
            <Button type="submit" disabled={isLoading || !chatInput.trim() || creatingSession}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              发送
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
