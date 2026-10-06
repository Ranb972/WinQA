import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import Insight from '@/models/Insight';
import { stripMongoOperators } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';
import {
  assertBelowCeiling,
  ownedPrivateRows,
  prepareInsightCreate,
  prepareInsightUpdate,
  validationErrorText,
} from '@/lib/server/content-input';

// Page size for the list: 50 by default, up to 200 with ?limit=. The page shows
// "Load more" while X-Next-Cursor comes back.
const LIST_PAGE = { def: 50, max: 200 };

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

    // The body under its cap, then each field's type and length, before the database.
    const parsed = await readJsonObject(request, BODY_LIMITS.insights);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const input = prepareInsightCreate(parsed.value);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    // The per-user ceiling (D7): count the caller's private rows, then create.
    const room = await assertBelowCeiling(Insight, ownedPrivateRows(userId), 'insights');
    if (!room.ok) {
      return NextResponse.json({ error: room.error }, { status: room.status });
    }

    const insight = await Insight.create({ user_id: userId, ...input.doc });

    return NextResponse.json(insight, { status: 201 });
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
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

    const parsed = await readJsonObject(request, BODY_LIMITS.insights);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value;
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Insight ID is required' },
        { status: 400 }
      );
    }

    const input = prepareInsightUpdate(body);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const insight = await Insight.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      { ...input.doc, updated_at: new Date() },
      { returnDocument: 'after', runValidators: true }
    );

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    return NextResponse.json(insight);
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
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
