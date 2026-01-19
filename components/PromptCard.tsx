'use client';

import { useState } from 'react';
import { Heart, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PromptCardProps {
  id: string;
  title: string;
  badPrompt: string;
  goodPrompt: string;
  explanation?: string;
  tags: string[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function PromptCard({
  title,
  badPrompt,
  goodPrompt,
  explanation,
  tags,
  isFavorite,
  onToggleFavorite,
  onEdit,
  onDelete,
}: PromptCardProps) {
  const [copiedBad, setCopiedBad] = useState(false);
  const [copiedGood, setCopiedGood] = useState(false);

  const handleCopy = async (text: string, type: 'bad' | 'good') => {
    await navigator.clipboard.writeText(text);
    if (type === 'bad') {
      setCopiedBad(true);
      setTimeout(() => setCopiedBad(false), 2000);
    } else {
      setCopiedGood(true);
      setTimeout(() => setCopiedGood(false), 2000);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFavorite}
              className={cn(
                'h-8 w-8 p-0',
                isFavorite ? 'text-rose-400' : 'text-slate-400 hover:text-rose-400'
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                className="bg-slate-800 text-slate-400 border-slate-700 text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bad Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-rose-400">Bad Prompt</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(badPrompt, 'bad')}
              className="h-6 px-2 text-slate-500 hover:text-slate-300"
            >
              {copiedBad ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="bg-rose-950/30 border border-rose-900/30 rounded-lg p-3">
            <p className="text-sm text-rose-300/80 whitespace-pre-wrap line-clamp-4">
              {badPrompt}
            </p>
          </div>
        </div>

        {/* Good Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-emerald-400">Good Prompt</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(goodPrompt, 'good')}
              className="h-6 px-2 text-slate-500 hover:text-slate-300"
            >
              {copiedGood ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-sm text-emerald-300/80 whitespace-pre-wrap line-clamp-4">
              {goodPrompt}
            </p>
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">
              Why it matters
            </p>
            <p className="text-sm text-slate-400">{explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
