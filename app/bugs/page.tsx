'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Filter, Bug, Search, Plus } from 'lucide-react';
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
  Open: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Investigating: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Resolved: 'bg-green-500/10 text-green-400 border-green-500/30',
};

const severityColors = {
  Low: 'bg-green-500/10 text-green-400 border-green-500/30',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  High: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const issueTypeColors = {
  Hallucination: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  Formatting: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Refusal: 'bg-red-500/10 text-red-400 border-red-500/30',
  Logic: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
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
            <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
              <Bug className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Bug Log
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Document AI failures and anomalies
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" />
              Add Bug
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Filters */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, response, or notes..."
              className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-white/30" />
            {mounted && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-28 sm:w-36 bg-white/[0.02] border-white/[0.06] font-mono text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                    <SelectItem value="all" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">All Status</SelectItem>
                    <SelectItem value="Open" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Open</SelectItem>
                    <SelectItem value="Investigating" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Investigating</SelectItem>
                    <SelectItem value="Resolved" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Resolved</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-24 sm:w-32 bg-white/[0.02] border-white/[0.06] font-mono text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                    <SelectItem value="all" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">All Severity</SelectItem>
                    <SelectItem value="Low" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Low</SelectItem>
                    <SelectItem value="Medium" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Medium</SelectItem>
                    <SelectItem value="High" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">High</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
                  <SelectTrigger className="w-28 sm:w-36 bg-white/[0.02] border-white/[0.06] font-mono text-xs">
                    <SelectValue placeholder="Issue Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                    <SelectItem value="all" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">All Types</SelectItem>
                    <SelectItem value="Hallucination" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Hallucination</SelectItem>
                    <SelectItem value="Formatting" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Formatting</SelectItem>
                    <SelectItem value="Refusal" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Refusal</SelectItem>
                    <SelectItem value="Logic" className="text-zinc-400 focus:bg-white/[0.04] font-mono text-xs">Logic</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-orange-500 rounded-full" />
        <h2 className="text-white text-sm font-semibold uppercase tracking-wide font-heading">Incident Reports</h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
          {filteredBugs.length} record{filteredBugs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] rounded-lg p-4">
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bug className="w-16 h-16 text-orange-500/20 mb-4" />
            <h3 className="font-heading text-lg font-semibold text-white mb-2">
              {hasActiveFilters ? 'NO MATCHING BUGS' : 'NO BUGS REPORTED'}
            </h3>
            <p className="text-sm text-white/50 max-w-xs mb-6">
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
              <div className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden hover:border-orange-500/30 transition-all duration-300 group">
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-orange-500/30 rounded-tl-lg pointer-events-none" />
                <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-orange-500/30 rounded-tr-lg pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-orange-500/30 rounded-bl-lg pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-orange-500/30 rounded-br-lg pointer-events-none" />

              {/* Header Row */}
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
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
                        'border cursor-pointer hover:opacity-80 transition-opacity text-[10px] font-mono font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full',
                        statusColors[bug.status]
                      )}
                    >
                      {bug.status}
                    </Badge>
                  </button>
                  <Badge
                    className={cn('border text-[10px] font-mono font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full', issueTypeColors[bug.issue_type])}
                  >
                    {bug.issue_type}
                  </Badge>
                  <Badge className={cn('border text-[10px] font-mono font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full', severityColors[bug.severity])}>
                    {bug.severity}
                  </Badge>
                  {bug.is_public && (
                    <Badge className="border border-orange-500/30 bg-orange-500/10 text-orange-500 text-[10px] font-mono font-semibold tracking-wider uppercase px-2.5 py-1 rounded-full">
                      Example
                    </Badge>
                  )}
                  <span className="text-xs text-zinc-400 truncate max-w-[120px] sm:max-w-none font-mono">
                    {modelDisplayNames[bug.model_used as LLMProvider] || bug.model_used}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                  <span className="text-[10px] font-mono text-white/30">
                    {formatDate(bug.created_at)}
                  </span>
                  {!bug.is_public && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(bug._id);
                      }}
                      className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {expandedId === bug._id ? (
                    <ChevronUp className="h-4 w-4 text-white/30" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/30" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === bug._id && (
                <div className="border-t border-white/[0.06] p-4 space-y-4 animate-slide-down">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">
                      Prompt
                    </p>
                    <p className="text-sm text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap">
                      {bug.prompt_context}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">
                      Model Response
                    </p>
                    <p className="text-sm text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {bug.model_response}
                    </p>
                  </div>

                  {bug.user_notes && (
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">
                        Notes
                      </p>
                      <p className="text-sm text-zinc-400">{bug.user_notes}</p>
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
        <DialogContent className="bg-black border border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">Update Status</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Change the status of this bug report
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {mounted && (
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-white/[0.02] border-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                  <SelectItem value="Open" className="text-zinc-400 focus:bg-white/[0.04]">Open</SelectItem>
                  <SelectItem value="Investigating" className="text-zinc-400 focus:bg-white/[0.04]">Investigating</SelectItem>
                  <SelectItem value="Resolved" className="text-zinc-400 focus:bg-white/[0.04]">Resolved</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setEditingBug(null)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors"
            >
              Update
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Bug Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">Add Bug Report</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Document an AI response issue you&apos;ve encountered
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Prompt Context *</label>
              <textarea
                value={formData.prompt_context}
                onChange={(e) => setFormData({ ...formData, prompt_context: e.target.value })}
                placeholder="What prompt or context triggered this issue?"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[80px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Model Response *</label>
              <textarea
                value={formData.model_response}
                onChange={(e) => setFormData({ ...formData, model_response: e.target.value })}
                placeholder="What was the problematic response?"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Model Used</label>
                {mounted && (
                  <Select
                    value={formData.model_used}
                    onValueChange={(value) => setFormData({ ...formData, model_used: value })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.02] border-white/[0.06]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      <SelectItem value="cohere" className="text-zinc-400 focus:bg-white/[0.04]">Cohere</SelectItem>
                      <SelectItem value="gemini" className="text-zinc-400 focus:bg-white/[0.04]">Gemini</SelectItem>
                      <SelectItem value="groq" className="text-zinc-400 focus:bg-white/[0.04]">Groq</SelectItem>
                      <SelectItem value="openrouter" className="text-zinc-400 focus:bg-white/[0.04]">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Issue Type</label>
                {mounted && (
                  <Select
                    value={formData.issue_type}
                    onValueChange={(value) => setFormData({ ...formData, issue_type: value as typeof formData.issue_type })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.02] border-white/[0.06]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      <SelectItem value="Hallucination" className="text-zinc-400 focus:bg-white/[0.04]">Hallucination</SelectItem>
                      <SelectItem value="Formatting" className="text-zinc-400 focus:bg-white/[0.04]">Formatting</SelectItem>
                      <SelectItem value="Refusal" className="text-zinc-400 focus:bg-white/[0.04]">Refusal</SelectItem>
                      <SelectItem value="Logic" className="text-zinc-400 focus:bg-white/[0.04]">Logic</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Severity</label>
                {mounted && (
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value as typeof formData.severity })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.02] border-white/[0.06]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                      <SelectItem value="Low" className="text-zinc-400 focus:bg-white/[0.04]">Low</SelectItem>
                      <SelectItem value="Medium" className="text-zinc-400 focus:bg-white/[0.04]">Medium</SelectItem>
                      <SelectItem value="High" className="text-zinc-400 focus:bg-white/[0.04]">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Notes (optional)</label>
              <textarea
                value={formData.user_notes}
                onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                placeholder="Any additional context or observations..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBug}
              disabled={isSubmitting}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isSubmitting ? 'Creating...' : 'Create Bug Report'}
            </button>
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
