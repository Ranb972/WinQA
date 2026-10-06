import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import { stripMongoOperators } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';
import {
  prepareBugReportCreate,
  prepareBugReportUpdate,
  validationErrorText,
} from '@/lib/server/content-input';

// Page size for the list: 50 by default, up to 200 with ?limit=. The page shows
// "Load more" while X-Next-Cursor comes back.
const LIST_PAGE = { def: 50, max: 200 };

// GET - One page of the user's bug reports plus all public ones, newest first
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
    const status = searchParams.get('status');
    const model = searchParams.get('model');
    const issueType = searchParams.get('issue_type');

    // Show user's own content + all public content
    const ownershipFilter = { $or: [{ user_id: userId }, { is_public: true }] };
    const filter: Record<string, unknown> = { ...ownershipFilter };
    if (status) filter.status = stripMongoOperators(status);
    if (model) filter.model_used = stripMongoOperators(model);
    if (issueType) filter.issue_type = stripMongoOperators(issueType);

    const { rows, nextCursor } = await pageQuery(BugReport, filter, 'created_at', parsed.page);

    return pageResponse(rows, nextCursor);
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bug reports' },
      { status: 500 }
    );
  }
}

// POST - Create new bug report
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The body under its cap, then each field's type and length, before the database.
    const parsed = await readJsonObject(request, BODY_LIMITS.bugs);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const input = prepareBugReportCreate(parsed.value);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const bugReport = await BugReport.create({ user_id: userId, ...input.doc });

    return NextResponse.json(bugReport, { status: 201 });
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    console.error('Error creating bug report:', error);
    return NextResponse.json(
      { error: 'Failed to create bug report' },
      { status: 500 }
    );
  }
}

// PUT - Update bug report (ownership verified)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await readJsonObject(request, BODY_LIMITS.bugs);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value;
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bug report ID is required' },
        { status: 400 }
      );
    }

    const input = prepareBugReportUpdate(body);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const bugReport = await BugReport.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      input.doc,
      { new: true, runValidators: true }
    );

    if (!bugReport) {
      return NextResponse.json(
        { error: 'Bug report not found or is read-only example content' },
        { status: 404 }
      );
    }

    return NextResponse.json(bugReport);
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    console.error('Error updating bug report:', error);
    return NextResponse.json(
      { error: 'Failed to update bug report' },
      { status: 500 }
    );
  }
}

// DELETE - Remove bug report (ownership verified)
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
        { error: 'Bug report ID is required' },
        { status: 400 }
      );
    }

    const bugReport = await BugReport.findOneAndDelete({ _id: id, user_id: userId, is_public: { $ne: true } });

    if (!bugReport) {
      return NextResponse.json(
        { error: 'Bug report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Bug report deleted successfully' });
  } catch (error) {
    console.error('Error deleting bug report:', error);
    return NextResponse.json(
      { error: 'Failed to delete bug report' },
      { status: 500 }
    );
  }
}
