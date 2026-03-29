'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, TestTube2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TestCaseCard from '@/components/TestCaseCard';
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

  const filteredCases = testCases.filter(
    (tc) =>
      tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.initial_prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
              <TestTube2 className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Test Cases
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Structured investigation scenarios
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button onClick={openNewDialog} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors">
              <Plus className="w-4 h-4" />
              New Test Case
            </button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search */}
      <MotionWrapper delay={0.1}>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test cases..."
            className="w-full pl-10 pr-4 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
          />
        </div>
      </MotionWrapper>

      {/* Section Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-orange-500 rounded-full" />
        <h2 className="text-white text-sm font-semibold uppercase tracking-wide font-heading">Case Library</h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
          {filteredCases.length} record{filteredCases.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-full max-w-[16rem]" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
              <Skeleton className="h-3 w-14 mb-2 mt-4" />
              <Skeleton className="h-16 w-full rounded-lg mb-4" />
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-full mb-4" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <MotionWrapper>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TestTube2 className="w-16 h-16 text-orange-500/20 mb-4" />
            <h3 className="font-heading text-lg font-semibold text-white mb-2">
              {searchQuery ? 'NO MATCHING TEST CASES' : 'NO TEST CASES YET'}
            </h3>
            <p className="text-sm text-white/50 max-w-xs mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first test case to get started'}
            </p>
            {!searchQuery && (
              <button onClick={openNewDialog} className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 text-sm text-orange-500 hover:bg-orange-500/20 transition-colors font-mono uppercase tracking-wider">
                + Create Test Case
              </button>
            )}
          </div>
        </MotionWrapper>
      ) : (
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((testCase) => (
            <StaggerItem key={testCase._id}>
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <TestCaseCard
                  id={testCase._id}
                  title={testCase.title}
                  description={testCase.description}
                  initialPrompt={testCase.initial_prompt}
                  expectedOutcome={testCase.expected_outcome}
                  isPublic={testCase.is_public}
                  onRun={() => handleRun(testCase)}
                  onEdit={() => handleEdit(testCase)}
                  onDelete={() => handleDelete(testCase._id)}
                  onView={() => {
                    setViewingTestCase(testCase);
                    setViewDialogOpen(true);
                  }}
                />
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
              {editingCase ? 'Edit Test Case' : 'New Test Case'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              {editingCase
                ? 'Update your test case details'
                : 'Create a new test case for AI testing'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Title *
              </label>
              <input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Code Generation Test"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Description
              </label>
              <input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the test"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Initial Prompt *
              </label>
              <textarea
                value={formData.initial_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, initial_prompt: e.target.value })
                }
                placeholder="The prompt to send to the AI model..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[120px]"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">
                Expected Outcome
              </label>
              <textarea
                value={formData.expected_outcome}
                onChange={(e) =>
                  setFormData({ ...formData, expected_outcome: e.target.value })
                }
                placeholder="What you expect the AI to respond with..."
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white text-sm font-mono outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 resize-none min-h-[80px]"
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
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : editingCase ? 'Update' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="bg-black border border-white/[0.08] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-xs uppercase tracking-[0.16em] text-white">
              {viewingTestCase?.title}
            </DialogTitle>
            {viewingTestCase?.description && (
              <DialogDescription className="text-sm text-zinc-400">
                {viewingTestCase.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Initial Prompt */}
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2 block">
                Prompt
              </label>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                  {viewingTestCase?.initial_prompt}
                </p>
              </div>
            </div>

            {/* Expected Outcome */}
            {viewingTestCase?.expected_outcome && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2 block">
                  Expected Outcome
                </label>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                    {viewingTestCase.expected_outcome}
                  </p>
                </div>
              </div>
            )}

            {/* Created Date */}
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
