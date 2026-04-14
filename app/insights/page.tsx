'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Lightbulb, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  const [viewingInsight, setViewingInsight] = useState<Insight | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

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
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Insights
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Investigation findings and patterns
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors">
              <Plus className="w-4 h-4" />
              Record Finding
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Tag Filter */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or content..."
              className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Tags:</span>
              <Badge
                className={`cursor-pointer transition-all text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 ${
                  !selectedTag
                    ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
                    : 'bg-white/[0.03] text-white/50 border-white/[0.04] hover:border-orange-500/30'
                }`}
                onClick={() => setSelectedTag(null)}
              >
                All
              </Badge>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  className={`cursor-pointer transition-all text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 ${
                    selectedTag === tag
                      ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
                      : 'bg-white/[0.03] text-white/50 border-white/[0.04] hover:border-orange-500/30'
                  }`}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-orange-500 rounded-full" />
        <h2 className="text-white text-sm font-semibold uppercase tracking-wide font-heading">Field Notes</h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
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
            <Lightbulb className="w-16 h-16 text-orange-500/20 mb-4" />
            <h3 className="font-heading text-lg font-semibold text-white mb-2">
              {hasActiveFilters ? 'NO MATCHING FINDINGS' : 'NO FINDINGS RECORDED'}
            </h3>
            <p className="text-sm text-white/50 max-w-xs mb-6">
              {hasActiveFilters
                ? 'Try adjusting your search or tag filter'
                : 'Document patterns and discoveries from your AI investigations.'}
            </p>
            {!hasActiveFilters && (
              <button onClick={openNewDialog} className="px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-orange-500/10 border border-orange-500/30 text-sm text-orange-500 hover:bg-orange-500/20 transition-colors font-mono uppercase tracking-wider">
                + Record First Finding
              </button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer key={selectedTag ?? 'all'} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsights.map((insight) => (
            <StaggerItem key={insight._id}>
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div
                  className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden hover:border-orange-500/30 transition-all duration-300 group h-[280px] flex flex-col cursor-pointer"
                  onClick={() => {
                    setViewingInsight(insight);
                    setViewDialogOpen(true);
                  }}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-orange-500/30 rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-orange-500/30 rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-orange-500/30 rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-orange-500/30 rounded-br-lg pointer-events-none" />

                  <div className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-orange-500 shrink-0" />
                        <h3 className="text-white text-lg font-semibold line-clamp-2">
                          {insight.title}
                        </h3>
                        {insight.is_public && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase border border-orange-500/30 bg-orange-500/10 text-orange-500 shrink-0">
                            Example
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(insight);
                          }}
                          className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!insight.is_public && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(insight._id);
                            }}
                            className="h-8 w-8 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-3 flex-1 overflow-hidden">
                    <p className="text-sm text-zinc-400 line-clamp-4">
                      {insight.content}
                    </p>

                    {insight.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {insight.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[10px] text-white/50 bg-white/[0.03] border border-white/[0.04] font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
                      Updated {formatDate(insight.updated_at)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">
              {editingInsight ? 'Update Finding' : 'Record Investigation Finding'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Record a pattern or discovery from your investigations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Finding Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Cohere struggles with Hebrew"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Detailed Findings *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Describe your findings in detail..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[150px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-orange-500/10 text-orange-500 border-orange-500/30 cursor-pointer text-[10px] font-mono"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} x
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
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
                  className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="px-4 py-2 border border-white/[0.1] bg-white/[0.02] hover:bg-white/[0.05] hover:border-orange-500/30 text-zinc-300 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestedTags
                  .filter((t) => !formData.tags.includes(t))
                  .map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-white/[0.03] text-white/50 border-white/[0.04] cursor-pointer hover:border-orange-500/30 text-[10px] font-mono"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : editingInsight ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">
              {viewingInsight?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1 block">
                Detailed Findings
              </label>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                {viewingInsight?.content}
              </p>
            </div>

            {viewingInsight?.tags && viewingInsight.tags.length > 0 && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1 block">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1">
                  {viewingInsight.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] text-white/50 bg-white/[0.03] border border-white/[0.04] font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
              <span>Created {formatDate(viewingInsight?.created_at || '')}</span>
              <span>Updated {formatDate(viewingInsight?.updated_at || '')}</span>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setViewDialogOpen(false)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors"
            >
              Close
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
