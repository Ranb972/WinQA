'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Lightbulb, Search, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';

interface Insight {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_public?: boolean;
}

const suggestedTags = ['Cohere', 'Gemini', 'Groq', 'Hebrew', 'Code', 'Formatting', 'Edge Cases'];

function InsightsPageContent() {
  const searchParams = useSearchParams();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<Insight | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  useEffect(() => {
    fetchInsights();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    if (paramsProcessed) return;

    const action = searchParams.get('action');

    if (action === 'new') {
      setTimeout(() => setDialogOpen(true), 100);
    }

    setParamsProcessed(true);
  }, [searchParams, paramsProcessed]);

  const fetchInsights = async () => {
    try {
      const response = await fetch('/api/insights');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setInsights(data);
      } else {
        setInsights([]);
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch insights');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch insights',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and content are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/insights';
      const method = editingInsight ? 'PUT' : 'POST';
      const body = editingInsight ? { id: editingInsight._id, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save insight');

      toast({
        title: editingInsight ? 'Insight updated' : 'Insight created',
        description: 'Your insight has been saved successfully.',
      });

      setDialogOpen(false);
      resetForm();
      fetchInsights();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save insight',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this insight?')) return;

    try {
      const response = await fetch(`/api/insights?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete insight');

      toast({
        title: 'Insight deleted',
        description: 'The insight has been removed.',
      });

      fetchInsights();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete insight',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (insight: Insight) => {
    setEditingInsight(insight);
    setFormData({
      title: insight.title,
      content: insight.content,
      tags: insight.tags,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingInsight(null);
    setFormData({
      title: '',
      content: '',
      tags: [],
    });
    setTagInput('');
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, trimmedTag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get all unique tags from insights
  const allTags = Array.from(new Set(insights.flatMap((insight) => insight.tags))).sort();

  // Filter insights by search and tag
  const filteredInsights = insights.filter((insight) => {
    const matchesSearch =
      searchQuery === '' ||
      insight.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      insight.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = !selectedTag || insight.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const hasActiveFilters = searchQuery || selectedTag;

  return (
    <div className="px-4 sm:px-0 pt-4 sm:pt-0 pb-12 sm:pb-0">
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-6 h-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Insights
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Investigation findings and patterns
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
            <button
              onClick={openNewDialog}
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0 border border-orange-500 text-orange-500 bg-transparent hover:bg-orange-500/10 font-mono text-xs font-medium tracking-wider px-4 py-2 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              RECORD FINDING
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Tag Filter */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or content..."
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-4 py-3 pl-10 font-sans text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-500/30 transition-colors"
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 shrink-0">Tags:</span>
              <button
                onClick={() => setSelectedTag(null)}
                className={`min-h-[44px] sm:min-h-0 font-mono text-xs px-3 py-1.5 rounded transition-colors ${
                  !selectedTag
                    ? 'bg-orange-500 text-black font-medium'
                    : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`min-h-[44px] sm:min-h-0 font-mono text-xs px-3 py-1.5 rounded transition-colors ${
                    selectedTag === tag
                      ? 'bg-orange-500 text-black font-medium'
                      : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-orange-500 shrink-0" />
        <h2 className="font-heading text-sm font-bold text-white tracking-wider uppercase">Field Notes</h2>
        <span className="font-mono text-xs text-white/30 tracking-wider uppercase hidden sm:inline">
          Documented discoveries
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-4" />
              <div className="flex gap-1 mb-3">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : filteredInsights.length === 0 ? (
        <MotionWrapper>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full border border-white/[0.06] flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="font-heading text-sm font-bold text-white/60 tracking-wider uppercase mb-2">
              {hasActiveFilters ? 'NO MATCHING FINDINGS' : 'NO FINDINGS RECORDED'}
            </h3>
            <p className="font-sans text-xs text-white/30 max-w-xs mb-6">
              {hasActiveFilters
                ? 'Try adjusting your search or tag filter'
                : 'Document patterns and discoveries from your AI investigations.'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={openNewDialog}
                className="min-h-[44px] sm:min-h-0 border border-orange-500 text-orange-500 bg-transparent hover:bg-orange-500/10 font-mono text-xs font-medium tracking-wider px-4 py-2 rounded transition-colors"
              >
                + RECORD FIRST FINDING
              </button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer key={selectedTag ?? 'all'} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsights.map((insight) => {
            const isExpanded = expandedCards.has(insight._id);
            return (
              <StaggerItem key={insight._id}>
                <motion.div
                  whileHover={{ scale: 1.01, y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="relative bg-white/[0.015] border border-white/[0.06] rounded p-4 hover:border-orange-500/20 transition-colors group">
                    {/* Corner accents - 8 orange lines */}
                    <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
                    <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60 pointer-events-none" />

                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <Lightbulb className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <h3 className="font-heading text-sm font-bold text-white leading-tight tracking-wider line-clamp-2 min-w-0 flex-1">
                          {insight.title}
                        </h3>
                        {insight.is_public && (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-orange-500 text-orange-500 bg-transparent shrink-0">
                            EXAMPLE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(insight);
                          }}
                          className="p-1 text-white/20 hover:text-orange-500/60 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {!insight.is_public && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(insight._id);
                            }}
                            className="p-1 text-white/20 hover:text-orange-500/60 transition-colors"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview / full content */}
                    <p className={`font-sans text-xs text-white/40 leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                      {insight.content}
                    </p>

                    {/* Tags */}
                    {insight.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {insight.tags.map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-white/50"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer: date + view details toggle */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                      <span className="font-mono text-[10px] text-white/30 tracking-wider">
                        {formatDate(insight.updated_at)}
                      </span>
                      <button
                        onClick={() => toggleCard(insight._id)}
                        className="flex items-center gap-1 min-h-[44px] sm:min-h-0 font-mono text-[10px] text-orange-500/60 hover:text-orange-500 transition-colors"
                      >
                        {isExpanded ? 'HIDE DETAILS' : 'VIEW DETAILS'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.06] rounded-lg p-6 w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
          <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
          <div className="absolute top-0 right-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-px h-3 bg-orange-500/60 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60 pointer-events-none" />

          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-white tracking-wider">
              {editingInsight ? 'Update Finding' : 'Record Investigation Finding'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Record a pattern or discovery from your investigations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-xs text-white/40 tracking-wider mb-1.5 block">
                Finding Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Cohere struggles with Hebrew"
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-white/40 tracking-wider mb-1.5 block">
                Detailed Findings *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Describe your findings in detail..."
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[150px]"
              />
            </div>

            <div>
              <label className="font-mono text-xs text-white/40 tracking-wider mb-1.5 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="min-h-[44px] sm:min-h-0 font-mono text-[10px] px-2 py-0.5 rounded bg-orange-500 text-black font-medium hover:bg-orange-400 transition-colors"
                  >
                    {tag} x
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Add tag..."
                  className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="min-h-[44px] sm:min-h-0 border border-orange-500 text-orange-500 bg-transparent hover:bg-orange-500/10 font-mono text-xs font-medium tracking-wider px-4 py-2 rounded transition-colors"
                >
                  ADD
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestedTags
                  .filter((t) => !formData.tags.includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="min-h-[44px] sm:min-h-0 font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-white/50 hover:bg-white/[0.08] transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="min-h-[44px] sm:min-h-0 text-white/50 hover:text-white font-mono text-xs font-medium tracking-wider px-4 py-2 transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-0 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs font-medium tracking-wider px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'SAVING...' : editingInsight ? 'UPDATE' : 'CREATE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Skeleton loading component
function InsightsPageSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Skeleton className="h-10 flex-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  return (
    <Suspense fallback={<InsightsPageSkeleton />}>
      <InsightsPageContent />
    </Suspense>
  );
}
