'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Filter, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { modelDisplayNames, LLMProvider } from '@/lib/llm';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';

interface BugReport {
  _id: string;
  prompt_context: string;
  model_response: string;
  model_used: string;
  issue_type: 'Hallucination' | 'Formatting' | 'Refusal' | 'Logic';
  severity: 'Low' | 'Medium' | 'High';
  user_notes?: string;
  status: 'Open' | 'Investigating' | 'Resolved';
  created_at: string;
}

const statusColors = {
  Open: 'bg-rose-600/20 text-rose-400 border-rose-600/30',
  Investigating: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
  Resolved: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
};

const severityColors = {
  Low: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  Medium: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
  High: 'bg-rose-600/20 text-rose-400 border-rose-600/30',
};

const issueTypeColors = {
  Hallucination: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  Formatting: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  Refusal: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  Logic: 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
};

export default function BugsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchBugs();
  }, [statusFilter]);

  const fetchBugs = async () => {
    try {
      let url = '/api/bugs';
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setBugs(data);
      } else {
        setBugs([]);
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch bug reports');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch bug reports',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bug report?')) return;

    try {
      const response = await fetch(`/api/bugs?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete bug report');

      toast({
        title: 'Bug report deleted',
        description: 'The bug report has been removed.',
      });

      fetchBugs();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete bug report',
        variant: 'destructive',
      });
    }
  };

  const handleStatusUpdate = async () => {
    if (!editingBug || !newStatus) return;

    try {
      const response = await fetch('/api/bugs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingBug._id, status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update bug report');

      toast({
        title: 'Status updated',
        description: `Bug status changed to ${newStatus}.`,
      });

      setEditingBug(null);
      fetchBugs();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update bug report',
        variant: 'destructive',
      });
    }
  };

  const openStatusDialog = (bug: BugReport) => {
    setEditingBug(bug);
    setNewStatus(bug.status);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <Bug className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text-primary">Bug Log</span>
              </h1>
              <p className="text-slate-400 mt-1">
                Track and manage AI response issues
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            {mounted && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 glass border-slate-700/50">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="glass border-slate-700/50">
                  <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
                    All Status
                  </SelectItem>
                  <SelectItem value="Open" className="text-slate-300 focus:bg-violet-600/20">
                    Open
                  </SelectItem>
                  <SelectItem value="Investigating" className="text-slate-300 focus:bg-violet-600/20">
                    Investigating
                  </SelectItem>
                  <SelectItem value="Resolved" className="text-slate-300 focus:bg-violet-600/20">
                    Resolved
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </MotionWrapper>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-slate-400">Loading bug reports...</div>
        </div>
      ) : bugs.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🐛</div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">
            No bugs reported
          </h3>
          <p className="text-slate-400">
            Bug reports will appear here when you flag issues in Chat Lab
          </p>
        </div>
      ) : (
        <StaggerContainer className="space-y-3">
          {bugs.map((bug) => (
            <StaggerItem key={bug._id}>
              <motion.div
                className="glass-card rounded-xl overflow-hidden"
                whileHover={{ scale: 1.01, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
              {/* Header Row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() =>
                  setExpandedId(expandedId === bug._id ? null : bug._id)
                }
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openStatusDialog(bug);
                    }}
                  >
                    <Badge
                      className={cn(
                        'border cursor-pointer hover:opacity-80 transition-opacity',
                        statusColors[bug.status]
                      )}
                    >
                      {bug.status}
                    </Badge>
                  </button>
                  <Badge
                    className={cn('border', issueTypeColors[bug.issue_type])}
                  >
                    {bug.issue_type}
                  </Badge>
                  <Badge className={cn('border', severityColors[bug.severity])}>
                    {bug.severity}
                  </Badge>
                  <span className="text-sm text-slate-300 ml-2">
                    {modelDisplayNames[bug.model_used as LLMProvider] || bug.model_used}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    {formatDate(bug.created_at)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(bug._id);
                    }}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {expandedId === bug._id ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === bug._id && (
                <div className="border-t border-slate-700/50 p-4 space-y-4 animate-slide-down">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Prompt
                    </p>
                    <p className="text-sm text-slate-300 bg-slate-950/50 rounded-lg p-3 whitespace-pre-wrap">
                      {bug.prompt_context}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Model Response
                    </p>
                    <p className="text-sm text-slate-300 bg-slate-950/50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {bug.model_response}
                    </p>
                  </div>

                  {bug.user_notes && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">
                        Notes
                      </p>
                      <p className="text-sm text-slate-400">{bug.user_notes}</p>
                    </div>
                  )}
                </div>
              )}
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Status Update Dialog */}
      <Dialog open={!!editingBug} onOpenChange={() => setEditingBug(null)}>
        <DialogContent className="glass border-slate-700/50">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Update Status</DialogTitle>
            <DialogDescription className="text-slate-400">
              Change the status of this bug report
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {mounted && (
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-slate-950/50 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass border-slate-700/50">
                  <SelectItem value="Open" className="text-slate-300 focus:bg-violet-600/20">
                    Open
                  </SelectItem>
                  <SelectItem value="Investigating" className="text-slate-300 focus:bg-violet-600/20">
                    Investigating
                  </SelectItem>
                  <SelectItem value="Resolved" className="text-slate-300 focus:bg-violet-600/20">
                    Resolved
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditingBug(null)}
              className="text-slate-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              className="btn-primary"
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
