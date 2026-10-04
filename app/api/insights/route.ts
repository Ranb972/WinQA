import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Insight from '@/models/Insight';
import { stripMongoOperators, pickAllowedFields } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

const ALLOWED_PUT_FIELDS = ['title', 'content', 'tags', 'category'];

// Page size for the list. The default equals the cap so no existing library is cut
// short before the UI learns to load more (D11).
const LIST_PAGE = { def: 200, max: 200 };

// GET - One page of the user's insights plus all public ones, most recently updated first.
// PUT sets updated_at, so an edit moves a row to the top: a row edited while a
// client is paging can be skipped by that client until it reloads (never duplicated).
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
    const tag = searchParams.get('tag');

    const filter: Record<string, unknown> = {
      $or: [{ user_id: userId }, { is_public: true }],
    };
    if (tag) filter.tags = stripMongoOperators(tag);

    const { rows, nextCursor } = await pageQuery(Insight, filter, 'updated_at', parsed.page);

    return pageResponse(rows, nextCursor);
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const body = await request.json();

    const insight = await Insight.create({
      user_id: userId,
      title: body.title,
      content: body.content,
      category: body.category,
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

// PUT - Update insight (ownership verified)
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
        { error: 'Insight ID is required' },
        { status: 400 }
      );
    }

    const updateData = pickAllowedFields(body, ALLOWED_PUT_FIELDS);

    const insight = await Insight.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
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

// DELETE - Remove insight (ownership verified)
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
        { error: 'Insight ID is required' },
        { status: 400 }
      );
    }

    const insight = await Insight.findOneAndDelete({ _id: id, user_id: userId, is_public: { $ne: true } });

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
