'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, TestTube2, Play, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';

interface TestCase {
  _id: string;
  title: string;
  description?: string;
  initial_prompt: string;
  expected_outcome?: string;
  created_at: string;
  is_public?: boolean;
}

export default function TestCasesPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    initial_prompt: '',
    expected_outcome: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingTestCase, setViewingTestCase] = useState<TestCase | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    try {
      const response = await fetch('/api/test-cases');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setTestCases(data);
      } else {
        setTestCases([]);
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch test cases');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch test cases',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.initial_prompt.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and prompt are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/test-cases';
      const method = editingCase ? 'PUT' : 'POST';
      const body = editingCase
        ? { id: editingCase._id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to save test case');

      toast({
        title: editingCase ? 'Test case updated' : 'Test case created',
        description: 'Your test case has been saved successfully.',
      });

      setDialogOpen(false);
      resetForm();
      fetchTestCases();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save test case',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test case?')) return;

    try {
      const response = await fetch(`/api/test-cases?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete test case');

      toast({
        title: 'Test case deleted',
        description: 'The test case has been removed.',
      });

      fetchTestCases();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete test case',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingCase(testCase);
    setFormData({
      title: testCase.title,
      description: testCase.description || '',
      initial_prompt: testCase.initial_prompt,
      expected_outcome: testCase.expected_outcome || '',
    });
    setDialogOpen(true);
  };

  const handleRun = (testCase: TestCase) => {
    const encodedPrompt = encodeURIComponent(testCase.initial_prompt);
    router.push(`/chat-lab?prompt=${encodedPrompt}`);
  };

  const resetForm = () => {
    setEditingCase(null);
    setFormData({
      title: '',
      description: '',
      initial_prompt: '',
      expected_outcome: '',
    });
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

  const filteredCases = testCases.filter(
    (tc) =>
      tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.initial_prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 sm:px-0 pt-4 sm:pt-0 pb-12 sm:pb-0">
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <TestTube2 className="w-6 h-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Test Cases
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Structured investigation scenarios
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 font-mono text-xs uppercase tracking-wider font-medium transition-colors">
              <Plus className="w-4 h-4" />
              File New Case
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search */}
      <MotionWrapper delay={0.1}>
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test cases..."
            className="w-full pl-12 pr-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-lg text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/30"
          />
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-orange-500" />
        <h2 className="text-white text-sm font-medium uppercase tracking-wider">Case Library</h2>
        <span className="bg-white/[0.05] text-white/50 text-xs font-mono px-2 py-0.5 rounded-full">
          {filteredCases.length}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-6">
              <Skeleton className="h-5 w-16 mb-3 rounded" />
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-full max-w-[16rem]" />
              <Skeleton className="h-4 w-12 mt-4" />
            </div>
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <MotionWrapper>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-4">
              <TestTube2 className="w-8 h-8 text-orange-500/20" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-white/50 mb-2">
              {searchQuery ? 'NO MATCHING CASES' : 'NO CASES FILED'}
            </h3>
            <p className="text-sm text-white/30 max-w-xs mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create structured test scenarios to systematically probe AI weaknesses.'}
            </p>
            {!searchQuery && (
              <button onClick={openNewDialog} className="px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 text-sm font-mono uppercase tracking-wider font-medium transition-colors">
                + File New Case
              </button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((testCase) => {
            const isExpanded = expandedCards.has(testCase._id);
            return (
              <StaggerItem key={testCase._id}>
                <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-lg p-6 hover:border-orange-500/20 transition-all duration-300 group">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60" />
                  </div>
                  <div className="absolute top-0 right-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute top-0 right-0 w-px h-3 bg-orange-500/60" />
                  </div>
                  <div className="absolute bottom-0 left-0 pointer-events-none">
                    <div className="absolute bottom-0 left-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute bottom-0 left-0 w-px h-3 bg-orange-500/60" />
                  </div>
                  <div className="absolute bottom-0 right-0 pointer-events-none">
                    <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
                    <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
                  </div>

                  {/* Edit icon */}
                  <button
                    onClick={() => handleEdit(testCase)}
                    className="absolute top-6 right-6 text-white/20 hover:text-orange-500/60 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Badge */}
                  {testCase.is_public && (
                    <span className="inline-block bg-orange-500/10 text-orange-400 text-[10px] font-mono tracking-[0.15em] uppercase px-2 py-1 rounded mb-3">
                      Example
                    </span>
                  )}

                  {/* Title */}
                  <h3 className="text-white font-semibold text-lg tracking-wide pr-8">{testCase.title}</h3>

                  {/* Description */}
                  {testCase.description && (
                    <p className="text-white/50 text-sm mt-2 line-clamp-2">{testCase.description}</p>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={() => toggleCard(testCase._id)}
                    className="flex items-center gap-1.5 mt-4 text-white/30 hover:text-orange-500/60 text-xs font-mono tracking-wider uppercase transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        Hide Details <ChevronUp className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        View Details <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Opening Statement */}
                      <div>
                        <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/40 mb-2">Opening Statement</p>
                        <div className="bg-white/[0.02] border border-white/[0.04] rounded px-3 py-2">
                          <p className="text-white/60 text-sm leading-relaxed">{testCase.initial_prompt}</p>
                        </div>
                      </div>

                      {/* Expected Verdict */}
                      {testCase.expected_outcome && (
                        <div>
                          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/40 mb-2">Expected Verdict</p>
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded px-3 py-2">
                            <p className="text-white/60 text-sm leading-relaxed">{testCase.expected_outcome}</p>
                          </div>
                        </div>
                      )}

                      {/* Execute button */}
                      <button
                        onClick={() => handleRun(testCase)}
                        className="w-full flex items-center justify-center gap-2 bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 py-3 text-sm font-medium tracking-[0.15em] uppercase transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Execute Case
                      </button>

                      {/* Delete (non-public only) */}
                      {!testCase.is_public && (
                        <button
                          onClick={() => handleDelete(testCase._id)}
                          className="w-full flex items-center justify-center gap-2 text-white/20 hover:text-red-400 py-1 text-xs font-mono tracking-wider uppercase transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Case
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
          <div className="absolute top-0 right-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute top-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 left-0 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 left-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 right-0 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>

          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-wide text-white">
              {editingCase ? 'Update Case File' : 'File Investigation Case'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              {editingCase
                ? 'Update your case file details'
                : 'Create a structured investigation scenario'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Case Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Code Generation Test"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 rounded"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Case Brief
              </label>
              <input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the test"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 rounded"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Opening Statement *
              </label>
              <textarea
                value={formData.initial_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, initial_prompt: e.target.value })
                }
                placeholder="The prompt to send to the AI model..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[120px] rounded"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-1.5 block">
                Expected Verdict
              </label>
              <textarea
                value={formData.expected_outcome}
                onChange={(e) =>
                  setFormData({ ...formData, expected_outcome: e.target.value })
                }
                placeholder="What you expect the AI to respond with..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[80px] rounded"
              />
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
              className="px-4 py-2 bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 font-mono text-xs uppercase tracking-[0.12em] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : editingCase ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-white/[0.06] w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          {/* Dialog corner accents */}
          <div className="absolute top-0 left-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute top-0 left-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute top-0 right-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute top-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 left-0 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 left-0 w-px h-3 bg-orange-500/60" />
          </div>
          <div className="absolute bottom-0 right-0 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-3 h-px bg-orange-500/60" />
            <div className="absolute bottom-0 right-0 w-px h-3 bg-orange-500/60" />
          </div>

          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-wide text-white">
              {viewingTestCase?.title}
            </DialogTitle>
            {viewingTestCase?.description && (
              <DialogDescription className="text-sm text-zinc-400">
                {viewingTestCase.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2 block">
                Opening Statement
              </label>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded px-3 py-2">
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                  {viewingTestCase?.initial_prompt}
                </p>
              </div>
            </div>

            {viewingTestCase?.expected_outcome && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2 block">
                  Expected Verdict
                </label>
                <div className="bg-white/[0.02] border border-white/[0.04] rounded px-3 py-2">
                  <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">
                    {viewingTestCase.expected_outcome}
                  </p>
                </div>
              </div>
            )}

            {viewingTestCase?.created_at && (
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
                Created {new Date(viewingTestCase.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
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
