'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { compareVersions } from '@/lib/actions/version.actions';
import * as jsondiffpatch from 'jsondiffpatch';
import 'jsondiffpatch/formatters/styles/html.css';

interface VersionDiffProps {
  versionId1: string;
  versionId2: string;
}

export function VersionDiff({ versionId1, versionId2 }: VersionDiffProps) {
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadDiff = async () => {
    setIsLoading(true);
    try {
      const delta = await compareVersions(versionId1, versionId2);
      const html = jsondiffpatch.formatters.html.format(delta, null);
      setDiffHtml(html);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <Button onClick={loadDiff} disabled={isLoading} className="mb-4">
        {isLoading ? '对比中...' : '对比版本'}
      </Button>
      {diffHtml && (
        <div
          className="diff-container"
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
      )}
    </Card>
  );
}
