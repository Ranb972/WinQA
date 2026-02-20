import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';

interface ExportData {
  exportDate: string;
  version: string;
  data: {
    bugs: Record<string, unknown>[];
    prompts: Record<string, unknown>[];
    testCases: Record<string, unknown>[];
    insights: Record<string, unknown>[];
  };
}

function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (!d.version || !d.data) return false;
  if (typeof d.data !== 'object') return false;

  const dataObj = d.data as Record<string, unknown>;
  return (
    Array.isArray(dataObj.bugs) &&
    Array.isArray(dataObj.prompts) &&
    Array.isArray(dataObj.testCases) &&
    Array.isArray(dataObj.insights)
  );
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data, mode } = body;

    if (!validateExportData(data)) {
      return NextResponse.json(
        { error: 'Invalid data format. Please use a valid WinQA export file.' },
        { status: 400 }
      );
    }

    if (mode !== 'merge' && mode !== 'replace') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "merge" or "replace".' },
        { status: 400 }
      );
    }

    await dbConnect();

    // If replace mode, delete all existing data for this user
    if (mode === 'replace') {
      await Promise.all([
        BugReport.deleteMany({ user_id: userId }),
        PromptLibrary.deleteMany({ user_id: userId }),
        TestCase.deleteMany({ user_id: userId }),
        Insight.deleteMany({ user_id: userId }),
      ]);
    }

    // Allowed fields per model (allowlist approach)
    const allowedFields: Record<string, string[]> = {
      bugs: ['prompt_context', 'model_response', 'model_used', 'issue_type', 'severity', 'user_notes', 'status'],
      prompts: ['title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags', 'is_favorite'],
      testCases: ['title', 'description', 'initial_prompt', 'expected_outcome', 'category', 'difficulty'],
      insights: ['title', 'content', 'category', 'tags'],
    };

    const now = new Date().toISOString();
    const prepareDoc = (doc: Record<string, unknown>, model: string) => {
      const allowed = allowedFields[model] || [];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in doc) {
          sanitized[key] = doc[key];
        }
      }
      return {
        ...sanitized,
        user_id: userId,
        created_at: (typeof doc.created_at === 'string' && doc.created_at) || now,
        updated_at: now,
      };
    };

    // Insert all data
    const results = {
      bugs: 0,
      prompts: 0,
      testCases: 0,
      insights: 0,
    };

    if (data.data.bugs.length > 0) {
      const result = await BugReport.insertMany(data.data.bugs.map((d) => prepareDoc(d, 'bugs')));
      results.bugs = result.length;
    }

    if (data.data.prompts.length > 0) {
      const result = await PromptLibrary.insertMany(data.data.prompts.map((d) => prepareDoc(d, 'prompts')));
      results.prompts = result.length;
    }

    if (data.data.testCases.length > 0) {
      const result = await TestCase.insertMany(data.data.testCases.map((d) => prepareDoc(d, 'testCases')));
      results.testCases = result.length;
    }

    if (data.data.insights.length > 0) {
      const result = await Insight.insertMany(data.data.insights.map((d) => prepareDoc(d, 'insights')));
      results.insights = result.length;
    }

    return NextResponse.json({
      success: true,
      mode,
      imported: results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
