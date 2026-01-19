import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Insight from '@/models/Insight';

// GET - List all insights
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    const filter: Record<string, unknown> = {};
    if (tag) filter.tags = tag;

    const insights = await Insight.find(filter).sort({ updated_at: -1 });
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// POST - Create new insight
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const insight = await Insight.create({
      title: body.title,
      content: body.content,
      tags: body.tags || [],
    });

    return NextResponse.json(insight, { status: 201 });
  } catch (error) {
    console.error('Error creating insight:', error);
    return NextResponse.json(
      { error: 'Failed to create insight' },
      { status: 500 }
    );
  }
}

// PUT - Update insight
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Insight ID is required' },
        { status: 400 }
      );
    }

    const insight = await Insight.findByIdAndUpdate(
      id,
      { ...updateData, updated_at: new Date() },
      { new: true, runValidators: true }
    );

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    return NextResponse.json(insight);
  } catch (error) {
    console.error('Error updating insight:', error);
    return NextResponse.json(
      { error: 'Failed to update insight' },
      { status: 500 }
    );
  }
}

// DELETE - Remove insight
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Insight ID is required' },
        { status: 400 }
      );
    }

    const insight = await Insight.findByIdAndDelete(id);

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Insight deleted successfully' });
  } catch (error) {
    console.error('Error deleting insight:', error);
    return NextResponse.json(
      { error: 'Failed to delete insight' },
      { status: 500 }
    );
  }
}
