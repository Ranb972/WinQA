import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';
import { pickAllowedFields } from '@/lib/security';

const ALLOWED_PUT_FIELDS = ['title', 'description', 'initial_prompt', 'expected_outcome', 'category', 'difficulty'];

// GET - List all test cases for the authenticated user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    let testCases = await TestCase.find({ user_id: userId }).sort({ created_at: -1 });

    // Legacy migration: claim unowned docs on first empty result
    if (testCases.length === 0) {
      const legacyCount = await TestCase.countDocuments({ user_id: { $exists: false } });
      if (legacyCount > 0) {
        await TestCase.updateMany({ user_id: { $exists: false } }, { $set: { user_id: userId } });
        testCases = await TestCase.find({ user_id: userId }).sort({ created_at: -1 });
      }
    }

    return NextResponse.json(testCases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test cases' },
      { status: 500 }
    );
  }
}

// POST - Create new test case
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await request.json();

    const testCase = await TestCase.create({
      user_id: userId,
      title: body.title,
      description: body.description,
      initial_prompt: body.initial_prompt,
      expected_outcome: body.expected_outcome,
      category: body.category,
      difficulty: body.difficulty,
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json(
      { error: 'Failed to create test case' },
      { status: 500 }
    );
  }
}

// PUT - Update test case (ownership verified)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    const updateData = pickAllowedFields(body, ALLOWED_PUT_FIELDS);

    const testCase = await TestCase.findOneAndUpdate(
      { _id: id, user_id: userId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!testCase) {
      return NextResponse.json(
        { error: 'Test case not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json(
      { error: 'Failed to update test case' },
      { status: 500 }
    );
  }
}

// DELETE - Remove test case (ownership verified)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    const testCase = await TestCase.findOneAndDelete({ _id: id, user_id: userId });

    if (!testCase) {
      return NextResponse.json(
        { error: 'Test case not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json(
      { error: 'Failed to delete test case' },
      { status: 500 }
    );
  }
}
