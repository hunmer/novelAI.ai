'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat, useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImportSettingsDialog } from '@/components/dialogs/import-settings-dialog';

interface KnowledgeEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface KnowledgeBaseTabProps {
  projectId: string;
}

export function KnowledgeBaseTab({ projectId }: KnowledgeBaseTabProps) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

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

  const handleCreateEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) {
      setFormError('请输入需要写入知识库的内容');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        content: content.trim(),
        metadata: title ? { title } : undefined,
      };

      const res = await fetch(`/api/projects/${projectId}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || '保存失败');
      }

      setContent('');
      setTitle('');
      await fetchEntries();
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
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
    return messages.map((message) => {
      const textParts = message.parts?.
        map((part) => (part.type === 'text' ? part.text : ''))
        .filter(Boolean);

      const textContent = textParts?.length
        ? textParts.join('\n')
        : typeof (message as { content?: unknown }).content === 'string'
          ? (message as { content?: string }).content
          : '';

      return {
        id: message.id,
        role: message.role,
        content: textContent,
      };
    });
  }, [messages]);

  const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    try {
      await sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: trimmed }],
      });
      setChatInput('');
      clearError();
    } catch (error) {
      console.error('发送聊天消息失败', error);
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    setChatInput((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  };

  const handleClearConversation = () => {
    setMessages([]);
    setChatInput('');
    clearError();
  };

  const handleRegenerate = () => {
    void regenerate();
  };

  const handleStop = () => {
    void stop();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
      <Card className="flex min-h-[600px] flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">知识库片段</h3>
          </div>
          <div className="flex items-center gap-2">
            <ImportSettingsDialog projectId={projectId} onImportComplete={fetchEntries} />
          </div>
        </div>

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
                        onClick={() => handleInsertSnippet(entry.content)}
                        title="插入到提问"
                      >
                        <Plus className="h-4 w-4" />
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

        <form onSubmit={handleCreateEntry} className="space-y-3 border-t px-5 py-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="knowledge-title">
              片段标题（可选）
            </label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：世界观设定-能源体系"
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
              placeholder="支持 Markdown，提交后自动生成Embedding"
              rows={5}
            />
          </div>
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setContent('');
                setTitle('');
                setFormError(null);
              }}
            >
              清空
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存片段
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex min-h-[600px] flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">知识库对话</h3>
            <p className="text-sm text-muted-foreground">
              使用内置的 useChat 钩子实时检索并回答
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            useChat
          </Badge>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {formattedMessages.length === 0 && !isLoading && (
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在生成答案…
              <Button variant="ghost" size="sm" onClick={handleStop}>
                <X className="mr-1 h-4 w-4" />
                停止
              </Button>
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
              <Button type="button" variant="ghost" size="sm" onClick={handleClearConversation}>
                清除对话
              </Button>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isLoading}
                  onClick={handleRegenerate}
                >
                  重新生成
                </Button>
              )}
            </div>
            <Button type="submit" disabled={isLoading || !chatInput.trim()}>
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
