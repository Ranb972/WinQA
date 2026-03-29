'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, Heart, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PromptCard from '@/components/PromptCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';

interface Prompt {
  _id: string;
  title: string;
  bad_prompt_example: string;
  good_prompt_example: string;
  explanation?: string;
  tags: string[];
  is_favorite: boolean;
  is_public?: boolean;
  created_at: string;
}

const suggestedTags = ['Formatting', 'Reasoning', 'Security', 'Code', 'Creative', 'Analysis'];

function PromptsPageContent() {
  const searchParams = useSearchParams();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    bad_prompt_example: '',
    good_prompt_example: '',
    explanation: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchPrompts();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    if (paramsProcessed) return;

    const filter = searchParams.get('filter');
    const action = searchParams.get('action');

    if (filter === 'favorites') {
      setShowFavoritesOnly(true);
    }

    if (action === 'new') {
      setTimeout(() => setDialogOpen(true), 100);
    }

    setParamsProcessed(true);
  }, [searchParams, paramsProcessed]);

  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/prompts');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setPrompts(data);
      } else {
        setPrompts([]);
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch prompts');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch prompts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (
      !formData.title.trim() ||
      !formData.bad_prompt_example.trim() ||
      !formData.good_prompt_example.trim()
    ) {
      toast({
        title: 'Validation Error',
        description: 'Title and both prompt examples are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/prompts';
      const method = editingPrompt ? 'PUT' : 'POST';
      const body = editingPrompt ? { id: editingPrompt._id, ...formData } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save prompt');

      toast({
        title: editingPrompt ? 'Prompt updated' : 'Prompt created',
        description: 'Your prompt has been saved successfully.',
      });

      setDialogOpen(false);
      resetForm();
      fetchPrompts();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save prompt',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await fetch(`/api/prompts?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete prompt');

      toast({
        title: 'Prompt deleted',
        description: 'The prompt has been removed.',
      });

      fetchPrompts();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete prompt',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');

      fetchPrompts();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update favorite status',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title,
      bad_prompt_example: prompt.bad_prompt_example,
      good_prompt_example: prompt.good_prompt_example,
      explanation: prompt.explanation || '',
      tags: prompt.tags,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPrompt(null);
    setFormData({
      title: '',
      bad_prompt_example: '',
      good_prompt_example: '',
      explanation: '',
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

  // Get all unique tags from prompts
  const allTags = Array.from(new Set(prompts.flatMap((p) => p.tags)));

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bad_prompt_example.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.good_prompt_example.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFavorite = !showFavoritesOnly || p.is_favorite;
    const matchesTag = !selectedTag || p.tags.includes(selectedTag);

    return matchesSearch && matchesFavorite && matchesTag;
  });

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
              <Library className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Prompt Library
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Interrogation techniques archive
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" />
              Archive Technique
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Filters */}
      <MotionWrapper delay={0.1}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
          />
        </div>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors shrink-0',
            showFavoritesOnly
              ? 'bg-orange-500 text-black font-semibold'
              : 'border border-white/[0.1] bg-white/[0.02] text-zinc-400 hover:text-white hover:border-orange-500/30'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-current')} />
          Favorites
        </button>

        {allTags.length > 0 && (
          <div className="w-full sm:w-auto flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  'cursor-pointer transition-all text-[10px] font-mono tracking-wider uppercase px-2 py-0.5',
                  selectedTag === tag
                    ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
                    : 'bg-white/[0.03] text-white/50 border-white/[0.04] hover:border-orange-500/30'
                )}
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
        <h2 className="text-white text-sm font-semibold uppercase tracking-wide font-heading">Prompt Archive</h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
          Documented techniques
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
              <div className="flex items-start justify-between mb-3">
                <Skeleton className="h-6 w-48" />
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
              <div className="flex gap-1 mb-4">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-20 w-full rounded-lg mb-4" />
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-20 w-full rounded-lg mb-4" />
              <Skeleton className="h-3 w-28 mb-2" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Library className="w-16 h-16 text-orange-500/20 mb-4" />
          <h3 className="font-heading text-lg font-semibold text-white mb-2">
            {searchQuery || showFavoritesOnly || selectedTag
              ? 'NO MATCHING TECHNIQUES'
              : 'NO TECHNIQUES ARCHIVED'}
          </h3>
          <p className="text-sm text-white/50 max-w-xs mb-6">
            {searchQuery || showFavoritesOnly || selectedTag
              ? 'Try adjusting your filters'
              : 'Start building your interrogation playbook. Save prompts that work.'}
          </p>
          {!searchQuery && !showFavoritesOnly && !selectedTag && (
            <button onClick={openNewDialog} className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 text-sm text-orange-500 hover:bg-orange-500/20 transition-colors font-mono uppercase tracking-wider">
              + Archive First Technique
            </button>
          )}
        </div>
      ) : (
        <StaggerContainer key={`${selectedTag ?? 'all'}-${showFavoritesOnly}`} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map((prompt) => (
            <StaggerItem key={prompt._id}>
              <PromptCard
                id={prompt._id}
                title={prompt.title}
                badPrompt={prompt.bad_prompt_example}
                goodPrompt={prompt.good_prompt_example}
                explanation={prompt.explanation}
                tags={prompt.tags}
                isFavorite={prompt.is_favorite}
                isPublic={prompt.is_public}
                onToggleFavorite={() => handleToggleFavorite(prompt._id)}
                onEdit={() => handleEdit(prompt)}
                onDelete={() => handleDelete(prompt._id)}
                onView={() => {
                  setViewingPrompt(prompt);
                  setViewDialogOpen(true);
                }}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">
              {editingPrompt ? 'Update Technique' : 'Archive Interrogation Technique'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Document a weak approach and its refined technique
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Specific Instructions"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-400 mb-1.5 block">
                Weak Approach *
              </label>
              <textarea
                value={formData.bad_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, bad_prompt_example: e.target.value })
                }
                placeholder="The ineffective prompt..."
                className="w-full px-3 py-2 bg-rose-950/20 border border-rose-900/30 text-rose-300 text-sm font-mono outline-none focus:border-rose-500/30 transition-colors placeholder:text-rose-400/50 resize-none min-h-[80px] sm:min-h-[100px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400 mb-1.5 block">
                Refined Technique *
              </label>
              <textarea
                value={formData.good_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, good_prompt_example: e.target.value })
                }
                placeholder="The improved prompt..."
                className="w-full px-3 py-2 bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 text-sm font-mono outline-none focus:border-emerald-500/30 transition-colors placeholder:text-emerald-400/50 resize-none min-h-[80px] sm:min-h-[100px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Analysis
              </label>
              <textarea
                value={formData.explanation}
                onChange={(e) =>
                  setFormData({ ...formData, explanation: e.target.value })
                }
                placeholder="Why is the refined technique more effective?"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[60px]"
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isSubmitting ? 'Saving...' : editingPrompt ? 'Update' : 'Archive'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">
              {viewingPrompt?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Bad Prompt */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose-400 mb-2 block">
                Weak Approach
              </label>
              <div className="bg-rose-950/30 border border-rose-900/30 rounded-lg p-4">
                <p className="text-sm text-rose-300/80 whitespace-pre-wrap">
                  {viewingPrompt?.bad_prompt_example}
                </p>
              </div>
            </div>

            {/* Good Prompt */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400 mb-2 block">
                Refined Technique
              </label>
              <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-4">
                <p className="text-sm text-emerald-300/80 whitespace-pre-wrap">
                  {viewingPrompt?.good_prompt_example}
                </p>
              </div>
            </div>

            {/* Explanation */}
            {viewingPrompt?.explanation && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2 block">
                  Analysis
                </label>
                <p className="text-sm text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                  {viewingPrompt.explanation}
                </p>
              </div>
            )}

            {/* Tags */}
            {viewingPrompt?.tags && viewingPrompt.tags.length > 0 && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2 block">
                  Tags
                </label>
                <div className="flex flex-wrap gap-1">
                  {viewingPrompt.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-orange-500/10 text-orange-500 border-orange-500/30 text-[10px] font-mono"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Favorite Status */}
            {viewingPrompt?.is_favorite && (
              <div className="flex items-center gap-2 text-sm text-orange-500">
                <Heart className="h-4 w-4 fill-current" />
                <span className="font-mono text-xs uppercase tracking-[0.12em]">Favorited</span>
              </div>
            )}
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
function PromptsPageSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function PromptsPage() {
  return (
    <Suspense fallback={<PromptsPageSkeleton />}>
      <PromptsPageContent />
    </Suspense>
  );
}
