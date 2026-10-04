import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';
import { stripMongoOperators, pickAllowedFields } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

const ALLOWED_PUT_FIELDS = ['prompt_context', 'model_response', 'issue_type', 'severity', 'user_notes', 'status'];

// Page size for the list. The default equals the cap so no existing library is cut
// short before the UI learns to load more (D11).
const LIST_PAGE = { def: 200, max: 200 };

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

    await dbConnect();
    const body = await request.json();

    const bugReport = await BugReport.create({
      user_id: userId,
      prompt_context: body.prompt_context,
      model_response: body.model_response,
      model_used: body.model_used,
      issue_type: body.issue_type,
      severity: body.severity,
      user_notes: body.user_notes,
      status: body.status || 'Open',
    });

    return NextResponse.json(bugReport, { status: 201 });
  } catch (error) {
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

    await dbConnect();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bug report ID is required' },
        { status: 400 }
      );
    }

    const updateData = pickAllowedFields(body, ALLOWED_PUT_FIELDS);

    const bugReport = await BugReport.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      updateData,
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
