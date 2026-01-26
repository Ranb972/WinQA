'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ChevronDown, ChevronUp, Filter, Bug, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchBugs();
  }, []);

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
                  <SelectTrigger className="w-36 glass border-slate-700/50">
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
                  <SelectTrigger className="w-32 glass border-slate-700/50">
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
                  <SelectTrigger className="w-36 glass border-slate-700/50">
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
        <StaggerContainer className="space-y-3">
          {filteredBugs.map((bug) => (
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
