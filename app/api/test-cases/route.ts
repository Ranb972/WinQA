import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';
import {
  assertBelowCeiling,
  ownedPrivateRows,
  prepareTestCaseCreate,
  prepareTestCaseUpdate,
  validationErrorText,
} from '@/lib/server/content-input';

// Page size for the list: 50 by default, up to 200 with ?limit=. The page shows
// "Load more" while X-Next-Cursor comes back.
const LIST_PAGE = { def: 50, max: 200 };

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

    // The body under its cap, then each field's type and length, before the database.
    const parsed = await readJsonObject(request, BODY_LIMITS.testCases);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const input = prepareTestCaseCreate(parsed.value);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    // The per-user ceiling (D7): count the caller's private rows, then create.
    const room = await assertBelowCeiling(TestCase, ownedPrivateRows(userId), 'testCases');
    if (!room.ok) {
      return NextResponse.json({ error: room.error }, { status: room.status });
    }

    const testCase = await TestCase.create({ user_id: userId, ...input.doc });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
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

    const parsed = await readJsonObject(request, BODY_LIMITS.testCases);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value;
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    const input = prepareTestCaseUpdate(body);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const testCase = await TestCase.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      input.doc,
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
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
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
