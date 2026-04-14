'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Filter, Bug, Search, Plus, AlertTriangle, FileText } from 'lucide-react';
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
  Open: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  Investigating: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Resolved: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const severityColors = {
  Low: 'bg-green-900/50 text-green-300',
  Medium: 'bg-amber-900/50 text-amber-300',
  High: 'bg-red-900/50 text-red-300',
};

const issueTypeColors = {
  Hallucination: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Formatting: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Refusal: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  Logic: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
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
            <div className="w-14 h-14 bg-white/[0.015] border border-white/[0.06] relative flex items-center justify-center">
              <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-orange-500" />
              <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 border-orange-500" />
              <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 border-orange-500" />
              <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-orange-500" />
              <Bug className="text-orange-500 w-7 h-7" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold uppercase tracking-wider text-white">
                Bug Log
              </h1>
              <p className="font-mono text-xs text-zinc-500 tracking-wide mt-1">
                Document AI failures and anomalies
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.1em] font-medium px-4 py-3.5 sm:py-2.5 flex items-center gap-2 transition-colors w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" />
              Log Incident
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Filters */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="bg-white/[0.015] border border-white/[0.06] focus-within:border-orange-500/30 relative flex items-center transition-colors">
            <Search className="text-white/40 w-4 h-4 ml-4" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by prompt, response, or notes..."
              className="bg-transparent border-0 text-sm text-white placeholder:text-white/30 font-mono py-3 px-3 flex-1 focus:outline-none"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-white/30" />
            {mounted && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-36 min-h-[44px] sm:min-h-0 bg-white/[0.02] border-white/[0.1] hover:border-orange-500/30 font-mono text-xs uppercase tracking-[0.1em] text-white/80">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/[0.08]">
                    <SelectItem value="all" className="text-white focus:bg-white/[0.04] font-mono text-xs">All Status</SelectItem>
                    <SelectItem value="Open" className="text-white focus:bg-white/[0.04] font-mono text-xs">Open</SelectItem>
                    <SelectItem value="Investigating" className="text-white focus:bg-white/[0.04] font-mono text-xs">Investigating</SelectItem>
                    <SelectItem value="Resolved" className="text-white focus:bg-white/[0.04] font-mono text-xs">Resolved</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-full sm:w-32 min-h-[44px] sm:min-h-0 bg-white/[0.02] border-white/[0.1] hover:border-orange-500/30 font-mono text-xs uppercase tracking-[0.1em] text-white/80">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/[0.08]">
                    <SelectItem value="all" className="text-white focus:bg-white/[0.04] font-mono text-xs">All Severity</SelectItem>
                    <SelectItem value="Low" className="text-white focus:bg-white/[0.04] font-mono text-xs">Low</SelectItem>
                    <SelectItem value="Medium" className="text-white focus:bg-white/[0.04] font-mono text-xs">Medium</SelectItem>
                    <SelectItem value="High" className="text-white focus:bg-white/[0.04] font-mono text-xs">High</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
                  <SelectTrigger className="w-full sm:w-36 min-h-[44px] sm:min-h-0 bg-white/[0.02] border-white/[0.1] hover:border-orange-500/30 font-mono text-xs uppercase tracking-[0.1em] text-white/80">
                    <SelectValue placeholder="Issue Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/[0.08]">
                    <SelectItem value="all" className="text-white focus:bg-white/[0.04] font-mono text-xs">All Types</SelectItem>
                    <SelectItem value="Hallucination" className="text-white focus:bg-white/[0.04] font-mono text-xs">Hallucination</SelectItem>
                    <SelectItem value="Formatting" className="text-white focus:bg-white/[0.04] font-mono text-xs">Formatting</SelectItem>
                    <SelectItem value="Refusal" className="text-white focus:bg-white/[0.04] font-mono text-xs">Refusal</SelectItem>
                    <SelectItem value="Logic" className="text-white focus:bg-white/[0.04] font-mono text-xs">Logic</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-4 bg-orange-500" />
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-white/60">Incident Reports</span>
        <span className="hidden sm:inline font-mono text-xs uppercase tracking-[0.15em] text-white/30">Active Investigations</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="font-mono text-xs text-white/40 whitespace-nowrap">{filteredBugs.length} cases</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-4 w-24 ml-2" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBugs.length === 0 ? (
        <MotionWrapper>
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.06] rounded-full mb-4 inline-flex items-center justify-center">
              <Bug className="text-white/20 w-8 h-8" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-white mb-2">
              {hasActiveFilters ? 'NO MATCHING INCIDENTS' : 'NO INCIDENTS LOGGED'}
            </h3>
            <p className="text-white/40 font-mono text-sm max-w-xs mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search or filters'
                : 'Your investigation logs are clean. Document AI failures as you find them.'}
            </p>
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer key={`${statusFilter}-${severityFilter}-${issueTypeFilter}`} className="space-y-3">
          {filteredBugs.map((bug) => (
            <StaggerItem key={bug._id}>
              <div className={cn(
                "bg-white/[0.015] border border-white/[0.06] hover:border-white/[0.1] relative transition-all duration-200",
                expandedId === bug._id && "border-orange-500/30"
              )}>
                {/* Corner accents */}
                <div className="absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 border-orange-500 pointer-events-none" />
                <div className="absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 border-orange-500 pointer-events-none" />
                <div className="absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 border-orange-500 pointer-events-none" />
                <div className="absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 border-orange-500 pointer-events-none" />

              {/* Header Row */}
              <div
                className="w-full p-4 hover:bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer"
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
                        'cursor-pointer hover:opacity-80 transition-opacity px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium',
                        statusColors[bug.status]
                      )}
                    >
                      {bug.status === 'Open' ? 'Open Case' : bug.status === 'Resolved' ? 'Case Closed' : bug.status}
                    </Badge>
                  </button>
                  <Badge
                    className={cn('px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium', issueTypeColors[bug.issue_type])}
                  >
                    {bug.issue_type}
                  </Badge>
                  <Badge className={cn('px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium', severityColors[bug.severity])}>
                    {bug.severity}
                  </Badge>
                  {bug.is_public && (
                    <Badge className="bg-white/[0.02] text-orange-400 border border-orange-500/30 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.1em] font-medium">
                      Example
                    </Badge>
                  )}
                  <span className="px-2 py-1 bg-white/[0.02] border border-white/[0.06] text-xs font-mono text-white/60">
                    {modelDisplayNames[bug.model_used as LLMProvider] || bug.model_used}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                  <span className="text-white/40 text-xs font-mono">
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
                  <ChevronDown className={cn(
                    "text-white/40 w-4 h-4 transition-transform duration-200",
                    expandedId === bug._id && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === bug._id && (
                <div className="border-t border-white/[0.06] p-6 space-y-6 animate-slide-down">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-2">
                      <FileText className="text-white/40 w-4 h-4" />
                      Evidence: Prompt
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed bg-white/[0.01] border border-white/[0.04] p-4 whitespace-pre-wrap">
                      {bug.prompt_context}
                    </p>
                  </div>

                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-2">
                      <AlertTriangle className="text-orange-500/60 w-4 h-4" />
                      Suspect Response
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed bg-white/[0.01] border border-white/[0.04] border-l-2 border-l-orange-500/50 p-4 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {bug.model_response}
                    </p>
                  </div>

                  {bug.user_notes && (
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.15em] text-white/40 mb-2 flex items-center gap-2">
                        <FileText className="text-white/40 w-4 h-4" />
                        Investigator Notes
                      </p>
                      <p className="text-sm text-zinc-300 leading-relaxed bg-white/[0.01] border border-white/[0.04] p-4 whitespace-pre-wrap">{bug.user_notes}</p>
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
        <DialogContent className="bg-black border border-white/[0.06]">
          <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-orange-500" />
          <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-orange-500" />
          <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-orange-500" />
          <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-orange-500" />
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold uppercase tracking-wider text-white">Update Case Status</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Change the status of this incident report
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {mounted && (
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-white/[0.015] border-white/[0.06] focus:border-orange-500/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/[0.08]">
                  <SelectItem value="Open" className="text-white focus:bg-white/[0.04]">Open</SelectItem>
                  <SelectItem value="Investigating" className="text-white focus:bg-white/[0.04]">Investigating</SelectItem>
                  <SelectItem value="Resolved" className="text-white focus:bg-white/[0.04]">Resolved</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setEditingBug(null)}
              className="border border-white/[0.1] bg-white/[0.02] hover:border-orange-500/30 text-white font-mono text-xs uppercase tracking-[0.1em] px-4 py-3.5 sm:py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStatusUpdate}
              className="bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.1em] font-medium px-4 py-3.5 sm:py-2.5 transition-colors"
            >
              Update
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Bug Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.06] w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-orange-500" />
          <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-orange-500" />
          <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-orange-500" />
          <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-orange-500" />
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold uppercase tracking-wider text-white">Log New Incident</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Document an AI failure or anomaly
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Evidence: Prompt *</label>
              <textarea
                value={formData.prompt_context}
                onChange={(e) => setFormData({ ...formData, prompt_context: e.target.value })}
                placeholder="What prompt or context triggered this issue?"
                className="bg-white/[0.015] border border-white/[0.06] focus:border-orange-500/30 text-sm text-white placeholder:text-white/30 p-4 w-full resize-none focus:outline-none transition-colors min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Suspect Response *</label>
              <textarea
                value={formData.model_response}
                onChange={(e) => setFormData({ ...formData, model_response: e.target.value })}
                placeholder="What was the problematic response?"
                className="bg-white/[0.015] border border-white/[0.06] focus:border-orange-500/30 text-sm text-white placeholder:text-white/30 p-4 w-full resize-none focus:outline-none transition-colors min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Suspect Model</label>
                {mounted && (
                  <Select
                    value={formData.model_used}
                    onValueChange={(value) => setFormData({ ...formData, model_used: value })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.015] border-white/[0.06] focus:border-orange-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/[0.08]">
                      <SelectItem value="cohere" className="text-white focus:bg-white/[0.04]">Cohere</SelectItem>
                      <SelectItem value="gemini" className="text-white focus:bg-white/[0.04]">Gemini</SelectItem>
                      <SelectItem value="groq" className="text-white focus:bg-white/[0.04]">Groq</SelectItem>
                      <SelectItem value="openrouter" className="text-white focus:bg-white/[0.04]">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Incident Type</label>
                {mounted && (
                  <Select
                    value={formData.issue_type}
                    onValueChange={(value) => setFormData({ ...formData, issue_type: value as typeof formData.issue_type })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.015] border-white/[0.06] focus:border-orange-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/[0.08]">
                      <SelectItem value="Hallucination" className="text-white focus:bg-white/[0.04]">Hallucination</SelectItem>
                      <SelectItem value="Formatting" className="text-white focus:bg-white/[0.04]">Formatting</SelectItem>
                      <SelectItem value="Refusal" className="text-white focus:bg-white/[0.04]">Refusal</SelectItem>
                      <SelectItem value="Logic" className="text-white focus:bg-white/[0.04]">Logic</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Severity</label>
                {mounted && (
                  <Select
                    value={formData.severity}
                    onValueChange={(value) => setFormData({ ...formData, severity: value as typeof formData.severity })}
                  >
                    <SelectTrigger className="w-full bg-white/[0.015] border-white/[0.06] focus:border-orange-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/[0.08]">
                      <SelectItem value="Low" className="text-white focus:bg-white/[0.04]">Low</SelectItem>
                      <SelectItem value="Medium" className="text-white focus:bg-white/[0.04]">Medium</SelectItem>
                      <SelectItem value="High" className="text-white focus:bg-white/[0.04]">High</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-mono text-xs uppercase tracking-[0.15em] text-white/40">Investigator Notes (optional)</label>
              <textarea
                value={formData.user_notes}
                onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                placeholder="Any additional context or observations..."
                className="bg-white/[0.015] border border-white/[0.06] focus:border-orange-500/30 text-sm text-white placeholder:text-white/30 p-4 w-full resize-none focus:outline-none transition-colors min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="border border-white/[0.1] bg-white/[0.02] hover:border-orange-500/30 text-white font-mono text-xs uppercase tracking-[0.1em] px-4 py-3.5 sm:py-2.5 transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBug}
              disabled={isSubmitting}
              className="bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.1em] font-medium px-4 py-3.5 sm:py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isSubmitting ? 'Logging...' : 'Log Incident'}
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
          <Skeleton key={i} className="h-32" />
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
