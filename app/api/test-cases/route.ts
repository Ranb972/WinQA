import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';
import { pickAllowedFields } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

const ALLOWED_PUT_FIELDS = ['title', 'description', 'initial_prompt', 'expected_outcome', 'category', 'difficulty'];

// Page size for the list. The default equals the cap so no existing library is cut
// short before the UI learns to load more (D11).
const LIST_PAGE = { def: 200, max: 200 };

// GET - One page of the user's test cases plus all public ones, newest first
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = parsePage(searchParams, LIST_PAGE);
    if (!parsed.ok) return parsed.response;

    await dbConnect();

    const { rows, nextCursor } = await pageQuery(
      TestCase,
      { $or: [{ user_id: userId }, { is_public: true }] },
      'created_at',
      parsed.page
    );

    return pageResponse(rows, nextCursor);
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
      { _id: id, user_id: userId, is_public: { $ne: true } },
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

    const testCase = await TestCase.findOneAndDelete({ _id: id, user_id: userId, is_public: { $ne: true } });

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
