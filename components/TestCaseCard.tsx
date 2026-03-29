'use client';

import { Play, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestCaseCardProps {
  id: string;
  title: string;
  description?: string;
  initialPrompt: string;
  expectedOutcome?: string;
  isPublic?: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onView?: () => void;
}

export default function TestCaseCard({
  title,
  description,
  initialPrompt,
  expectedOutcome,
  isPublic,
  onRun,
  onEdit,
  onDelete,
  onView,
}: TestCaseCardProps) {
  return (
    <div
      className={cn(
        "relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden hover:border-orange-500/30 transition-all duration-300 h-[320px] flex flex-col group",
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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-white text-lg font-semibold line-clamp-2">{title}</h3>
              {isPublic && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase border border-orange-500/30 bg-orange-500/10 text-orange-500 shrink-0">
                  Example
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-zinc-400 mt-1 line-clamp-1">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
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
      </div>
      <div className="px-4 pb-4 space-y-3 flex-1 overflow-hidden flex flex-col">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Prompt</p>
          <p className="text-sm text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 line-clamp-3">
            {initialPrompt}
          </p>
        </div>
        {expectedOutcome && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1">Expected</p>
            <p className="text-sm text-zinc-400 line-clamp-2">{expectedOutcome}</p>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors mt-auto"
        >
          <Play className="h-4 w-4" />
          Run Test
        </button>
      </div>
    </div>
  );
}
