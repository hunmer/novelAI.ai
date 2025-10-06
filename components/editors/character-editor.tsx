'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  generateCharacter,
  getCharacters,
  updateCharacter,
  deleteCharacter,
} from '@/lib/actions/character.actions';
import { SparklesIcon, PlusIcon, TrashIcon } from 'lucide-react';
import type { Character } from '@prisma/client';

interface CharacterEditorProps {
  projectId: string;
  worldContext?: string;
}

export function CharacterEditor({ projectId, worldContext }: CharacterEditorProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [projectId]);

  const loadCharacters = async () => {
    const data = await getCharacters(projectId);
    setCharacters(data);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const result = await generateCharacter(projectId, prompt, worldContext);
      if (result.success) {
        await loadCharacters();
        setSelectedId(result.data.id);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Character>) => {
    await updateCharacter(id, updates);
    await loadCharacters();
  };

  const handleDelete = async (id: string) => {
    await deleteCharacter(id);
    await loadCharacters();
    if (selectedId === id) setSelectedId(null);
  };

  const selected = characters.find((c) => c.id === selectedId);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-4">
        <Card className="p-4">
          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述角色,例如: 创建一个神秘的赏金猎人..."
              rows={3}
            />
            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <SparklesIcon className="h-4 w-4 mr-2" />
              生成角色
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">角色列表</h3>
          {characters.map((char) => (
            <Card
              key={char.id}
              className={`p-3 cursor-pointer ${
                selectedId === char.id ? 'border-primary' : ''
              }`}
              onClick={() => setSelectedId(char.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{char.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(char.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="col-span-2">
        {selected ? (
          <Card className="p-4 space-y-4">
            <Input
              value={selected.name}
              onChange={(e) => handleUpdate(selected.id, { name: e.target.value })}
            />
            <Textarea
              value={selected.attributes}
              onChange={(e) => handleUpdate(selected.id, { attributes: e.target.value })}
              rows={20}
              className="font-mono"
            />
          </Card>
        ) : (
          <Card className="p-12 text-center text-muted-foreground">
            选择或生成一个角色
          </Card>
        )}
      </div>
    </div>
  );
}
