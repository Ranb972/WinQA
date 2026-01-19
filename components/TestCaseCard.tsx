'use client';

import { Play, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface TestCaseCardProps {
  id: string;
  title: string;
  description?: string;
  initialPrompt: string;
  expectedOutcome?: string;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TestCaseCard({
  title,
  description,
  initialPrompt,
  expectedOutcome,
  onRun,
  onEdit,
  onDelete,
}: TestCaseCardProps) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="text-slate-400 mt-1">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
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
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Prompt</p>
          <p className="text-sm text-slate-300 bg-slate-950 rounded-lg p-3 line-clamp-3">
            {initialPrompt}
          </p>
        </div>
        {expectedOutcome && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Expected</p>
            <p className="text-sm text-slate-400 line-clamp-2">{expectedOutcome}</p>
          </div>
        )}
        <Button
          onClick={onRun}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
        >
          <Play className="h-4 w-4 mr-2" />
          Run Test
        </Button>
      </CardContent>
    </Card>
  );
}
