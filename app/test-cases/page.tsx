'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Search, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <TestTube2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text-primary">Test Cases</span>
              </h1>
              <p className="text-slate-400 mt-1">
                Manage and run your AI testing scenarios
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={openNewDialog} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Test Case
            </Button>
          </motion.div>
        </div>
      </MotionWrapper>

      {/* Search */}
      <MotionWrapper delay={0.1}>
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search test cases..."
            className="pl-10 glass border-slate-700/50 text-slate-100 focus:border-violet-500/50"
          />
        </div>
      </MotionWrapper>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
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
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🧪</div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              {searchQuery ? 'No matching test cases' : 'No test cases yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first test case to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={openNewDialog} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Create Test Case
              </Button>
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
                  onRun={() => handleRun(testCase)}
                  onEdit={() => handleEdit(testCase)}
                  onDelete={() => handleDelete(testCase._id)}
                />
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
              {editingCase ? 'Edit Test Case' : 'New Test Case'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingCase
                ? 'Update your test case details'
                : 'Create a new test case for AI testing'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Title *
              </label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Code Generation Test"
                className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of the test"
                className="bg-slate-950/50 border-slate-700 text-slate-100 focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Initial Prompt *
              </label>
              <Textarea
                value={formData.initial_prompt}
                onChange={(e) =>
                  setFormData({ ...formData, initial_prompt: e.target.value })
                }
                placeholder="The prompt to send to the AI model..."
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[120px] focus:border-violet-500/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">
                Expected Outcome
              </label>
              <Textarea
                value={formData.expected_outcome}
                onChange={(e) =>
                  setFormData({ ...formData, expected_outcome: e.target.value })
                }
                placeholder="What you expect the AI to respond with..."
                className="bg-slate-950/50 border-slate-700 text-slate-100 min-h-[80px] focus:border-violet-500/50"
              />
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
              {isSubmitting ? 'Saving...' : editingCase ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
