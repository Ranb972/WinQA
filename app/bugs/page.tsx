'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Filter, Bug, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  is_public?: boolean;
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

function BugsPageContent() {
  const searchParams = useSearchParams();
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [formData, setFormData] = useState({
    prompt_context: '',
    model_response: '',
    model_used: 'cohere',
    issue_type: 'Hallucination' as 'Hallucination' | 'Formatting' | 'Refusal' | 'Logic',
    severity: 'Medium' as 'Low' | 'Medium' | 'High',
    user_notes: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchBugs();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    if (paramsProcessed) return;

    const status = searchParams.get('status');
    const action = searchParams.get('action');

    if (status === 'Open' || status === 'Investigating' || status === 'Resolved') {
      setStatusFilter(status);
    }

    if (action === 'new') {
      setTimeout(() => setDialogOpen(true), 100);
    }

    setParamsProcessed(true);
  }, [searchParams, paramsProcessed]);

  const fetchBugs = async () => {
    try {
      const response = await fetch('/api/bugs');
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

  const resetForm = () => {
    setFormData({
      prompt_context: '',
      model_response: '',
      model_used: 'cohere',
      issue_type: 'Hallucination',
      severity: 'Medium',
      user_notes: '',
    });
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleCreateBug = async () => {
    if (!formData.prompt_context.trim() || !formData.model_response.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Prompt and model response are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create bug report');

      toast({
        title: 'Bug report created',
        description: 'Your bug report has been saved successfully.',
      });

      setDialogOpen(false);
      resetForm();
      fetchBugs();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create bug report',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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

  const filteredBugs = bugs.filter((bug) => {
    const matchesSearch =
      searchQuery === '' ||
      bug.prompt_context.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bug.model_response.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bug.user_notes?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === 'all' || bug.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || bug.severity === severityFilter;
    const matchesIssueType = issueTypeFilter === 'all' || bug.issue_type === issueTypeFilter;

    return matchesSearch && matchesStatus && matchesSeverity && matchesIssueType;
  });

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || severityFilter !== 'all' || issueTypeFilter !== 'all';

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
              <Bug className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                <span className="text-white">Bug Log</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base mt-1">
                Track and manage AI response issues
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={openNewDialog} className="btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Bug
            </Button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Filters */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, response, or notes..."
              className="pl-10 glass border-slate-700/50 text-slate-100 focus:border-violet-500/50"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-slate-500" />
            {mounted && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-28 sm:w-36 glass border-slate-700/50 text-sm">
                    <SelectValue placeholder="Status" />
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

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-24 sm:w-32 glass border-slate-700/50 text-sm">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent className="glass border-slate-700/50">
                    <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
                      All Severity
                    </SelectItem>
                    <SelectItem value="Low" className="text-slate-300 focus:bg-violet-600/20">
                      Low
                    </SelectItem>
                    <SelectItem value="Medium" className="text-slate-300 focus:bg-violet-600/20">
                      Medium
                    </SelectItem>
                    <SelectItem value="High" className="text-slate-300 focus:bg-violet-600/20">
                      High
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
                  <SelectTrigger className="w-28 sm:w-36 glass border-slate-700/50 text-sm">
                    <SelectValue placeholder="Issue Type" />
                  </SelectTrigger>
                  <SelectContent className="glass border-slate-700/50">
                    <SelectItem value="all" className="text-slate-300 focus:bg-violet-600/20">
                      All Types
                    </SelectItem>
                    <SelectItem value="Hallucination" className="text-slate-300 focus:bg-violet-600/20">
                      Hallucination
                    </SelectItem>
                    <SelectItem value="Formatting" className="text-slate-300 focus:bg-violet-600/20">
                      Formatting
                    </SelectItem>
                    <SelectItem value="Refusal" className="text-slate-300 focus:bg-violet-600/20">
                      Refusal
                    </SelectItem>
                    <SelectItem value="Logic" className="text-slate-300 focus:bg-violet-600/20">
                      Logic
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      </MotionWrapper>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-24 ml-2" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBugs.length === 0 ? (
        <MotionWrapper>
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🐛</div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              {hasActiveFilters ? 'No matching bugs' : 'No bugs reported'}
            </h3>
            <p className="text-slate-400">
              {hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Bug reports will appear here when you flag issues in Chat Lab'}
            </p>
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer key={`${statusFilter}-${severityFilter}-${issueTypeFilter}`} className="space-y-3">
          {filteredBugs.map((bug) => (
            <StaggerItem key={bug._id}>
              <div className="glass-card rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
              {/* Header Row */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() =>
                  setExpandedId(expandedId === bug._id ? null : bug._id)
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openStatusDialog(bug);
                    }}
                  >
                    <Badge
                      className={cn(
                        'border cursor-pointer hover:opacity-80 transition-opacity text-xs',
                        statusColors[bug.status]
                      )}
                    >
                      {bug.status}
                    </Badge>
                  </button>
                  <Badge
                    className={cn('border text-xs', issueTypeColors[bug.issue_type])}
                  >
                    {bug.issue_type}
                  </Badge>
                  <Badge className={cn('border text-xs', severityColors[bug.severity])}>
                    {bug.severity}
                  </Badge>
                  {bug.is_public && (
                    <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                      Example
                    </Badge>
                  )}
                  <span className="text-xs sm:text-sm text-slate-300 truncate max-w-[120px] sm:max-w-none">
                    {modelDisplayNames[bug.model_used as LLMProvider] || bug.model_used}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                  <span className="text-xs text-slate-500">
                    {formatDate(bug.created_at)}
                  </span>
                  {!bug.is_public && (
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
                  )}
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
              </div>
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

      {/* Add New Bug Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass border-slate-700/50 w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Add Bug Report</DialogTitle>
            <DialogDescription className="text-slate-400">
              Document an AI response issue you&apos;ve encountered
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Prompt Context *</label>
              <Textarea
                value={formData.prompt_context}
                onChange={(e) => setFormData({ ...formData, prompt_context: e.target.value })}
                placeholder="What prompt or context triggered this issue?"
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[80px] focus:border-slate-600 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Model Response *</label>
              <Textarea
                value={formData.model_response}
                onChange={(e) => setFormData({ ...formData, model_response: e.target.value })}
                placeholder="What was the problematic response?"
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[100px] focus:border-slate-600 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Model Used</label>
                {mounted && (
                  <Select
                    value={formData.model_used}
                    onValueChange={(value) => setFormData({ ...formData, model_used: value })}
                  >
                    <SelectTrigger className="w-full bg-slate-950/50 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass border-slate-700/50">
                      <SelectItem value="cohere" className="text-slate-300 focus:bg-violet-600/20">Cohere</SelectItem>
                      <SelectItem value="gemini" className="text-slate-300 focus:bg-violet-600/20">Gemini</SelectItem>
                      <SelectItem value="groq" className="text-slate-300 focus:bg-violet-600/20">Groq</SelectItem>
                      <SelectItem value="openrouter" className="text-slate-300 focus:bg-violet-600/20">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Issue Type</label>
                {mounted && (
                  <Select
                    value={formData.issue_type}
                    onValueChange={(value) => setFormData({ ...formData, issue_type: value as typeof formData.issue_type })}
                  >
                    <SelectTrigger className="w-full bg-slate-950/50 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass border-slate-700/50">
                      <SelectItem value="Hallucination" className="text-slate-300 focus:bg-violet-600/20">Hallucination</SelectItem>
                      <SelectItem value="Formatting" className="text-slate-300 focus:bg-violet-600/20">Formatting</SelectItem>
                      <SelectItem value="Refusal" className="text-slate-300 focus:bg-violet-600/20">Refusal</SelectItem>
                      <SelectItem value="Logic" className="text-slate-300 focus:bg-violet-600/20">Logic</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Severity</label>
                {mounted && (
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value as typeof formData.severity })}
                  >
                    <SelectTrigger className="w-full bg-slate-950/50 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass border-slate-700/50">
                      <SelectItem value="Low" className="text-slate-300 focus:bg-violet-600/20">Low</SelectItem>
                      <SelectItem value="Medium" className="text-slate-300 focus:bg-violet-600/20">Medium</SelectItem>
                      <SelectItem value="High" className="text-slate-300 focus:bg-violet-600/20">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Notes (optional)</label>
              <Textarea
                value={formData.user_notes}
                onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                placeholder="Any additional context or observations..."
                className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-slate-600 focus:ring-1 focus:ring-violet-500/30 transition-colors"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-slate-400 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBug}
              disabled={isSubmitting}
              className="btn-primary w-full sm:w-auto"
            >
              {isSubmitting ? 'Creating...' : 'Create Bug Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Skeleton loading component
function BugsPageSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function BugsPage() {
  return (
    <Suspense fallback={<BugsPageSkeleton />}>
      <BugsPageContent />
    </Suspense>
  );
}
