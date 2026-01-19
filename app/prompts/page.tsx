'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Heart, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';

interface Prompt {
  _id: string;
  title: string;
  bad_prompt_example: string;
  good_prompt_example: string;
  explanation?: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
}

const suggestedTags = ['Formatting', 'Reasoning', 'Security', 'Code', 'Creative', 'Analysis'];

export default function PromptsPage() {
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

  const { toast } = useToast();

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const response = await fetch('/api/prompts');
      const data = await response.json();
      setPrompts(data);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch prompts',
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Library className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text-primary">Prompt Library</span>
              </h1>
              <p className="text-slate-400 mt-1">
                Compare bad vs good prompts and learn best practices
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={openNewDialog} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Prompt
            </Button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Filters */}
      <MotionWrapper delay={0.1}>
        <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="pl-10 glass border-slate-700/50 text-slate-100 focus:border-violet-500/50"
          />
        </div>

        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={cn(
            'transition-all',
            showFavoritesOnly
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 border-none text-white'
              : 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-violet-500/50'
          )}
        >
          <Heart className={cn('h-4 w-4 mr-2', showFavoritesOnly && 'fill-current')} />
          Favorites
        </Button>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <Badge
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  'cursor-pointer transition-all',
                  selectedTag === tag
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white border-transparent'
                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-violet-500/50'
                )}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        </div>
      </MotionWrapper>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-slate-400">Loading prompts...</div>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">
            {searchQuery || showFavoritesOnly || selectedTag
              ? 'No matching prompts'
              : 'No prompts yet'}
          </h3>
          <p className="text-slate-400 mb-6">
            {searchQuery || showFavoritesOnly || selectedTag
              ? 'Try adjusting your filters'
              : 'Start building your prompt library'}
          </p>
          {!searchQuery && !showFavoritesOnly && !selectedTag && (
            <Button onClick={openNewDialog} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add First Prompt
            </Button>
          )}
        </div>
      ) : (
        <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPrompts.map((prompt) => (
            <StaggerItem key={prompt._id}>
              <motion.div
                whileHover={{ scale: 1.01, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <PromptCard
                  id={prompt._id}
                  title={prompt.title}
                  badPrompt={prompt.bad_prompt_example}
                  goodPrompt={prompt.good_prompt_example}
                  explanation={prompt.explanation}
                  tags={prompt.tags}
                  isFavorite={prompt.is_favorite}
                  onToggleFavorite={() => handleToggleFavorite(prompt._id)}
                  onEdit={() => handleEdit(prompt)}
                  onDelete={() => handleDelete(prompt._id)}
                />
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass border-slate-700/50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingPrompt ? 'Edit Prompt' : 'Add Prompt'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Document a bad prompt example and its improved version
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Specific Instructions"
                className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-rose-400 mb-1 block">
                Bad Prompt *
              </label>
              <Textarea
                value={formData.bad_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, bad_prompt_example: e.target.value })
                }
                placeholder="The ineffective prompt..."
                className="bg-rose-950/20 border-rose-900/30 text-rose-300 placeholder:text-rose-400/50 min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-emerald-400 mb-1 block">
                Good Prompt *
              </label>
              <Textarea
                value={formData.good_prompt_example}
                onChange={(e) =>
                  setFormData({ ...formData, good_prompt_example: e.target.value })
                }
                placeholder="The improved prompt..."
                className="bg-emerald-950/20 border-emerald-900/30 text-emerald-300 placeholder:text-emerald-400/50 min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Explanation
              </label>
              <Textarea
                value={formData.explanation}
                onChange={(e) =>
                  setFormData({ ...formData, explanation: e.target.value })
                }
                placeholder="Why is the good prompt better?"
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[60px] focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-violet-600/20 text-violet-400 border-violet-600/30 cursor-pointer"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Add tag..."
                  className="bg-slate-950/50 border-slate-700 text-slate-100 flex-1 focus:border-violet-500/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addTag(tagInput)}
                  className="border-slate-700 hover:border-violet-500/50"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {suggestedTags
                  .filter((t) => !formData.tags.includes(t))
                  .map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-slate-800/50 text-slate-500 border-slate-700 cursor-pointer hover:border-violet-500/50 text-xs"
                      onClick={() => addTag(tag)}
                    >
                      + {tag}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-slate-400 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? 'Saving...' : editingPrompt ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
