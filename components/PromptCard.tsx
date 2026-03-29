'use client';

import { useState } from 'react';
import { Heart, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PromptCardProps {
  id: string;
  title: string;
  badPrompt: string;
  goodPrompt: string;
  explanation?: string;
  tags: string[];
  isFavorite: boolean;
  isPublic?: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView?: () => void;
}

export default function PromptCard({
  title,
  badPrompt,
  goodPrompt,
  explanation,
  tags,
  isFavorite,
  isPublic,
  onToggleFavorite,
  onEdit,
  onDelete,
  onView,
}: PromptCardProps) {
  const [copiedBad, setCopiedBad] = useState(false);
  const [copiedGood, setCopiedGood] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (text: string, type: 'bad' | 'good') => {
    await navigator.clipboard.writeText(text);
    if (type === 'bad') {
      setCopiedBad(true);
      setTimeout(() => setCopiedBad(false), 2000);
    } else {
      setCopiedGood(true);
      setTimeout(() => setCopiedGood(false), 2000);
    }
    toast({
      title: 'Copied to clipboard',
      description: `${type === 'good' ? 'Good' : 'Bad'} prompt copied`,
    });
  };

  return (
    <div
      className={cn(
        "relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden hover:border-orange-500/30 transition-all duration-300 h-[420px] flex flex-col group",
        onView && "cursor-pointer"
      )}
      onClick={onView}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-orange-500/30 rounded-tl-lg pointer-events-none" />
      <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-orange-500/30 rounded-tr-lg pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-orange-500/30 rounded-bl-lg pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-orange-500/30 rounded-br-lg pointer-events-none" />

      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <h3 className="text-white text-lg font-semibold line-clamp-2">{title}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                'h-8 w-8 flex items-center justify-center transition-colors',
                isFavorite ? 'text-orange-500' : 'text-white/30 hover:text-orange-500'
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!isPublic && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {isPublic && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase border border-orange-500/30 bg-orange-500/10 text-orange-500">
              Example
            </span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded text-[10px] text-white/50 bg-white/[0.03] border border-white/[0.04] font-mono"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 space-y-4 flex-1 overflow-hidden">
        {/* Bad Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-400">Weak Approach</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(badPrompt, 'bad');
              }}
              className="h-6 px-2 flex items-center text-white/30 hover:text-white/60 transition-colors"
            >
              {copiedBad ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
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
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">Refined Technique</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(goodPrompt, 'good');
              }}
              className="h-6 px-2 flex items-center text-white/30 hover:text-white/60 transition-colors"
            >
              {copiedGood ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
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
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">
              Analysis
            </p>
            <p className="text-sm text-zinc-400 line-clamp-2">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
