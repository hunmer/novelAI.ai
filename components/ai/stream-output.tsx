'use client';

import { useCompletion } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export function StreamOutput({ apiEndpoint }: { apiEndpoint: string }) {
  const { completion, input, handleInputChange, handleSubmit, isLoading } = useCompletion({
    api: apiEndpoint,
  });

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={input}
          onChange={handleInputChange}
          placeholder="输入生成需求..."
          rows={4}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '生成中...' : '生成'}
        </Button>
      </form>
      {completion && (
        <Card className="p-4">
          <pre className="whitespace-pre-wrap">{completion}</pre>
        </Card>
      )}
    </div>
  );
}
