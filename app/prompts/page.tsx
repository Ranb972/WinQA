'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, Heart, Library, Copy, Check, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [copiedStates, setCopiedStates] = useState<Record<string, 'bad' | 'good' | null>>({});

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
    setPrompts(prev =>
      prev.map(p => p._id === id ? { ...p, is_favorite: !p.is_favorite } : p)
    );

    try {
      const response = await fetch('/api/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');
    } catch {
      setPrompts(prev =>
        prev.map(p => p._id === id ? { ...p, is_favorite: !p.is_favorite } : p)
      );
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

  const handleCopy = async (text: string, id: string, type: 'bad' | 'good') => {
    await navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: type }));
    setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: null })), 2000);
    toast({
      title: 'Copied to clipboard',
      description: `${type === 'good' ? 'Good' : 'Bad'} prompt copied`,
    });
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
            <div className="w-1 h-8 bg-orange-500 shrink-0" />
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Library className="w-6 h-6 text-orange-500" />
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
            <button onClick={openNewDialog} className="flex items-center gap-2 bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 rounded text-sm font-medium tracking-wider uppercase transition-colors w-full sm:w-auto justify-center">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-12 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-lg text-white text-sm font-mono outline-none focus:border-orange-500/50 transition-colors placeholder:text-white/30"
            />
          </div>

          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto rounded-lg font-mono text-xs uppercase tracking-[0.12em] transition-colors shrink-0',
              showFavoritesOnly
                ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
                : 'bg-white/[0.02] border border-white/[0.06] text-white/50 hover:border-white/10'
            )}
          >
            <Heart className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-current')} />
            Favorites
          </button>

          {allTags.length > 0 && (
            <div className="w-full sm:w-auto flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={cn(
                    'px-3 py-2 sm:px-2 sm:py-0.5 min-h-[36px] sm:min-h-0 rounded text-[10px] font-mono tracking-wider uppercase transition-colors border',
                    selectedTag === tag
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : 'bg-white/[0.02] text-white/50 border-white/[0.06] hover:border-white/10'
                  )}
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
        <div className="w-1 h-5 bg-orange-500" />
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-orange-400">Prompt Archive</span>
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30">Documented Techniques</span>
        <span className="bg-white/[0.05] text-white/50 text-xs font-mono px-2 py-0.5 rounded-full">
          {filteredPrompts.length}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-16 rounded" />
                <Skeleton className="h-5 w-12 rounded" />
              </div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-12 mt-3" />
            </div>
          ))}
        </div>
      ) : filteredPrompts.length === 0 ? (
        <MotionWrapper>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-4">
              <Library className="w-8 h-8 text-orange-500/20" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-white/50 mb-2">
              {searchQuery || showFavoritesOnly || selectedTag
                ? 'NO MATCHING TECHNIQUES'
                : 'NO TECHNIQUES ARCHIVED'}
            </h3>
            <p className="text-sm text-white/30 max-w-xs mb-6">
              {searchQuery || showFavoritesOnly || selectedTag
                ? 'Try adjusting your filters'
                : 'Start building your interrogation playbook. Save prompts that work.'}
            </p>
            {!searchQuery && !showFavoritesOnly && !selectedTag && (
              <button onClick={openNewDialog} className="bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 px-4 py-2 rounded text-sm font-medium tracking-wider uppercase transition-colors">
                + Archive First Technique
              </button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer key={`${selectedTag ?? 'all'}-${showFavoritesOnly}`} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map((prompt) => {
            const isExpanded = expandedCards.has(prompt._id);
            const copied = copiedStates[prompt._id];
            return (
              <StaggerItem key={prompt._id}>
                <div className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg p-6 hover:border-orange-500/30 hover:bg-white/[0.02] transition-all duration-300 group">
                  {/* Corner accents — top-left */}
                  <div className="absolute top-0 left-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60" />
                  </div>
                  {/* Corner accents — bottom-right */}
                  <div className="absolute bottom-0 right-0 pointer-events-none">
                    <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
                  </div>

                  {/* Top row: icons */}
                  <div className="absolute top-5 right-5 flex items-center gap-1">
                    <button
                      onClick={() => handleToggleFavorite(prompt._id)}
                      className={cn(
                        'p-1 transition-colors',
                        prompt.is_favorite ? 'text-orange-500' : 'text-white/20 hover:text-orange-400'
                      )}
                    >
                      <Heart className={cn('w-4 h-4', prompt.is_favorite && 'fill-orange-500')} />
                    </button>
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="p-1 text-white/20 hover:text-orange-400 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tags + badge row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 pr-20">
                    {prompt.is_public && (
                      <span className="bg-orange-500/10 text-orange-400 text-[10px] font-mono px-2 py-0.5 rounded">
                        Example
                      </span>
                    )}
                    {prompt.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-white/[0.04] text-white/40 text-[10px] font-mono px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Title */}
                  <h3 className="text-white font-semibold text-lg tracking-wide pr-20">{prompt.title}</h3>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleCard(prompt._id)}
                    className="flex items-center gap-1.5 mt-3 text-white/40 hover:text-white/60 text-xs font-mono tracking-wider uppercase transition-colors"
                  >
                    {isExpanded ? (
                      <>Hide Details <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>View Details <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Weak Approach */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40">Weak Approach</p>
                          <button
                            onClick={() => handleCopy(prompt.bad_prompt_example, prompt._id, 'bad')}
                            className="text-white/20 hover:text-white/60 transition-colors"
                          >
                            {copied === 'bad' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="bg-white/[0.02] rounded p-3">
                          <p className="text-white/50 text-sm whitespace-pre-wrap">{prompt.bad_prompt_example}</p>
                        </div>
                      </div>

                      {/* Refined Technique */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-orange-400">Refined Technique</p>
                          <button
                            onClick={() => handleCopy(prompt.good_prompt_example, prompt._id, 'good')}
                            className="text-white/20 hover:text-white/60 transition-colors"
                          >
                            {copied === 'good' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="bg-white/[0.02] border-l-2 border-l-orange-500/30 rounded p-3">
                          <p className="text-white/70 text-sm whitespace-pre-wrap">{prompt.good_prompt_example}</p>
                        </div>
                      </div>

                      {/* Analysis */}
                      {prompt.explanation && (
                        <div>
                          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2">Analysis</p>
                          <p className="text-white/40 text-xs leading-relaxed">{prompt.explanation}</p>
                        </div>
                      )}

                      {/* Delete (non-public only) */}
                      {!prompt.is_public && (
                        <button
                          onClick={() => handleDelete(prompt._id)}
                          className="w-full flex items-center justify-center gap-2 text-white/20 hover:text-red-400 py-1 text-xs font-mono tracking-wider uppercase transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Technique
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-white/[0.06] w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          {/* Dialog corner accents */}
          <div className="absolute top-0 left-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 right-0 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>

          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-wide text-white">
              {editingPrompt ? 'Update Technique' : 'Archive Interrogation Technique'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Document a weak approach and its refined technique
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Specific Instructions"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Weak Approach *
              </label>
              <textarea
                value={formData.bad_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, bad_prompt_example: e.target.value })
                }
                placeholder="The ineffective prompt..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[80px] sm:min-h-[100px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-orange-400 mb-1.5 block">
                Refined Technique *
              </label>
              <textarea
                value={formData.good_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, good_prompt_example: e.target.value })
                }
                placeholder="The improved prompt..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[80px] sm:min-h-[100px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Analysis
              </label>
              <textarea
                value={formData.explanation}
                onChange={(e) =>
                  setFormData({ ...formData, explanation: e.target.value })
                }
                placeholder="Why is the refined technique more effective?"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[60px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <button
                    key={tag}
                    className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-mono"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} x
                  </button>
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
                  className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="px-4 py-2 border border-white/[0.06] hover:border-white/10 bg-white/[0.02] text-white/50 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors rounded"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestedTags
                  .filter((t) => !formData.tags.includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      className="bg-white/[0.02] text-white/50 border border-white/[0.06] hover:border-white/10 px-2 py-0.5 rounded text-[10px] font-mono transition-colors"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors w-full sm:w-auto rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 font-mono text-xs uppercase tracking-[0.12em] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto rounded"
            >
              {isSubmitting ? 'Saving...' : editingPrompt ? 'Update' : 'Archive'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-white/[0.06] w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
          {/* Dialog corner accents */}
          <div className="absolute top-0 left-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 right-0 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>

          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-wide text-white">
              {viewingPrompt?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Weak Approach */}
            <div>
              <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2">
                Weak Approach
              </p>
              <div className="bg-white/[0.02] rounded p-3">
                <p className="text-white/50 text-sm whitespace-pre-wrap">
                  {viewingPrompt?.bad_prompt_example}
                </p>
              </div>
            </div>

            {/* Refined Technique */}
            <div>
              <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-orange-400 mb-2">
                Refined Technique
              </p>
              <div className="bg-white/[0.02] border-l-2 border-l-orange-500/30 rounded p-3">
                <p className="text-white/70 text-sm whitespace-pre-wrap">
                  {viewingPrompt?.good_prompt_example}
                </p>
              </div>
            </div>

            {/* Analysis */}
            {viewingPrompt?.explanation && (
              <div>
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2">
                  Analysis
                </p>
                <p className="text-white/40 text-xs leading-relaxed">
                  {viewingPrompt.explanation}
                </p>
              </div>
            )}

            {/* Tags */}
            {viewingPrompt?.tags && viewingPrompt.tags.length > 0 && (
              <div>
                <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/40 mb-2">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {viewingPrompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-mono"
                    >
                      {tag}
                    </span>
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
              className="px-4 py-2 border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-white font-mono text-xs uppercase tracking-[0.12em] transition-colors rounded"
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
          <Skeleton key={i} className="h-32 rounded-lg" />
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
