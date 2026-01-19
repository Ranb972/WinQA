'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LLMProvider, modelDisplayNames } from '@/lib/llm';
import { IssueType, Severity } from '@/models/BugReport';

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptContext: string;
  modelResponse: string;
  modelUsed: LLMProvider;
}

const issueTypes: IssueType[] = ['Hallucination', 'Formatting', 'Refusal', 'Logic'];
const severities: Severity[] = ['Low', 'Medium', 'High'];

export default function BugReportModal({
  open,
  onOpenChange,
  promptContext,
  modelResponse,
  modelUsed,
}: BugReportModalProps) {
  const [issueType, setIssueType] = useState<IssueType>('Hallucination');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [userNotes, setUserNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_context: promptContext,
          model_response: modelResponse,
          model_used: modelUsed,
          issue_type: issueType,
          severity,
          user_notes: userNotes,
        }),
      });

      if (!response.ok) throw new Error('Failed to create bug report');

      toast({
        title: 'Bug reported',
        description: 'The bug has been logged successfully.',
      });

      onOpenChange(false);
      setUserNotes('');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create bug report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Report Bug</DialogTitle>
          <DialogDescription className="text-slate-400">
            Document an issue with the AI response for tracking and analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Model Info */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Model:</span>
            <span className="text-slate-200">{modelDisplayNames[modelUsed]}</span>
          </div>

          {/* Prompt Context Preview */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              Prompt
            </label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-24 overflow-y-auto">
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{promptContext}</p>
            </div>
          </div>

          {/* Response Preview */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              Response
            </label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{modelResponse}</p>
            </div>
          </div>

          {/* Issue Type & Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Issue Type
              </label>
              {mounted && (
                <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {issueTypes.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="text-slate-300 focus:bg-slate-800"
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Severity
              </label>
              {mounted && (
                <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                  <SelectTrigger className="bg-slate-950 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {severities.map((sev) => (
                      <SelectItem
                        key={sev}
                        value={sev}
                        className="text-slate-300 focus:bg-slate-800"
                      >
                        {sev}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* User Notes */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              Notes (optional)
            </label>
            <Textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Describe what went wrong..."
              className="bg-slate-950 border-slate-700 text-slate-300 placeholder:text-slate-600 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isSubmitting ? 'Submitting...' : 'Report Bug'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
