'use client';

import { Play, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card
      className={cn(
        "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] transition-colors h-[320px] flex flex-col",
        onView && "cursor-pointer"
      )}
      onClick={onView}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-slate-100 text-lg line-clamp-2">{title}</CardTitle>
              {isPublic && (
                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  Example
                </span>
              )}
            </div>
            {description && (
              <CardDescription className="text-zinc-400 mt-1 line-clamp-1">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-slate-100"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {!isPublic && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 overflow-hidden flex flex-col">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Prompt</p>
          <p className="text-sm text-zinc-400 bg-white/[0.02] rounded-lg p-3 line-clamp-3">
            {initialPrompt}
          </p>
        </div>
        {expectedOutcome && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Expected</p>
            <p className="text-sm text-zinc-400 line-clamp-2">{expectedOutcome}</p>
          </div>
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-auto"
        >
          <Play className="h-4 w-4 mr-2" />
          Run Test
        </Button>
      </CardContent>
    </Card>
  );
}
