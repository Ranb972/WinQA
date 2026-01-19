import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BugReport from '@/models/BugReport';

// GET - List all bug reports
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const model = searchParams.get('model');
    const issueType = searchParams.get('issue_type');

    const filter: Record<string, string> = {};
    if (status) filter.status = status;
    if (model) filter.model_used = model;
    if (issueType) filter.issue_type = issueType;

    const bugs = await BugReport.find(filter).sort({ created_at: -1 });
    return NextResponse.json(bugs);
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
    await dbConnect();
    const body = await request.json();

    const bugReport = await BugReport.create({
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

// PUT - Update bug report
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Bug report ID is required' },
        { status: 400 }
      );
    }

    const bugReport = await BugReport.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!bugReport) {
      return NextResponse.json(
        { error: 'Bug report not found' },
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

// DELETE - Remove bug report
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Bug report ID is required' },
        { status: 400 }
      );
    }

    const bugReport = await BugReport.findByIdAndDelete(id);

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
