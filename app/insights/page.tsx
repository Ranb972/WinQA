'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Lightbulb, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

const suggestedTags = ['Cohere', 'Gemini', 'Groq', 'Hebrew', 'Code', 'Formatting', 'Edge Cases'];

export default function InsightsPage() {
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

  const { toast } = useToast();

  useEffect(() => {
    fetchInsights();
  }, []);

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
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text-primary">Insights</span>
              </h1>
              <p className="text-slate-400 mt-1">
                Document your learnings about AI models and prompt engineering
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={openNewDialog} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Insight
            </Button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search & Tag Filter */}
      <MotionWrapper delay={0.1}>
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or content..."
              className="pl-10 glass border-slate-700/50 text-slate-100 focus:border-violet-500/50"
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">Tags:</span>
              <Badge
                className={`cursor-pointer transition-all ${
                  !selectedTag
                    ? 'bg-violet-600/30 text-violet-300 border-violet-500/50'
                    : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-violet-500/50'
                }`}
                onClick={() => setSelectedTag(null)}
              >
                All
              </Badge>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  className={`cursor-pointer transition-all ${
                    selectedTag === tag
                      ? 'bg-violet-600/30 text-violet-300 border-violet-500/50'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-violet-500/50'
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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-6">
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
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💡</div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              {hasActiveFilters ? 'No matching insights' : 'No insights yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {hasActiveFilters
                ? 'Try adjusting your search or tag filter'
                : 'Start documenting your learnings about AI behavior'}
            </p>
            {!hasActiveFilters && (
              <Button onClick={openNewDialog} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Add First Insight
              </Button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsights.map((insight) => (
            <StaggerItem key={insight._id}>
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Card className="glass-card card-hover group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                    <CardTitle className="text-slate-100 text-lg">
                      {insight.title}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(insight)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(insight._id)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                  {insight.content}
                </p>

                {insight.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {insight.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="bg-violet-600/20 text-violet-400 border-violet-600/30 text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Updated {formatDate(insight.updated_at)}
                </p>
              </CardContent>
            </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass border-slate-700/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingInsight ? 'Edit Insight' : 'New Insight'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Document a learning or observation about AI models
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
                placeholder="e.g., Cohere struggles with Hebrew"
                className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Content *
              </label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Describe your insight in detail..."
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[150px] focus:border-violet-500/50"
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
                    className="bg-amber-600/20 text-amber-400 border-amber-600/30 cursor-pointer"
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
              {isSubmitting ? 'Saving...' : editingInsight ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
