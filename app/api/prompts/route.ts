import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import PromptLibrary from '@/models/PromptLibrary';
import UserFavorite from '@/models/UserFavorite';
import { stripMongoOperators } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';
import { BODY_LIMITS } from '@/lib/server/body-limits';
import { readJsonObject } from '@/lib/server/read-json-body';
import {
  preparePromptCreate,
  preparePromptUpdate,
  validationErrorText,
} from '@/lib/server/content-input';

// Page size for the list: 50 by default, up to 200 with ?limit=. The page shows
// "Load more" while X-Next-Cursor comes back.
const LIST_PAGE = { def: 50, max: 200 };

// GET - One page of the user's prompts plus all public ones, newest first
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
    const favorite = searchParams.get('favorite');

    // Fetch user's favorites
    const userFavorites = await UserFavorite.find({ user_id: userId }).lean();
    const favoriteIds = new Set(userFavorites.map(f => f.prompt_id.toString()));

    const filter: Record<string, unknown> = {
      $or: [{ user_id: userId }, { is_public: true }],
    };
    if (tag) filter.tags = stripMongoOperators(tag);

    // If filtering by favorites, restrict to user's favorited prompt IDs
    if (favorite === 'true') {
      if (favoriteIds.size === 0) {
        return NextResponse.json([]);
      }
      filter._id = { $in: Array.from(favoriteIds) };
    }

    const { rows: prompts, nextCursor } = await pageQuery(
      PromptLibrary,
      filter,
      'created_at',
      parsed.page
    );

    // Merge per-user favorite state onto each prompt
    const promptsWithFavorites = prompts.map(p => ({
      ...p,
      is_favorite: favoriteIds.has(p._id.toString()),
    }));

    return pageResponse(promptsWithFavorites, nextCursor);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// POST - Create new prompt
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The body under its cap, then each field's type and length, before the database.
    const parsed = await readJsonObject(request, BODY_LIMITS.prompts);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const input = preparePromptCreate(parsed.value);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const prompt = await PromptLibrary.create({ user_id: userId, ...input.doc });

    return NextResponse.json(prompt, { status: 201 });
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    console.error('Error creating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}

// PUT - Update prompt (ownership verified)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await readJsonObject(request, BODY_LIMITS.prompts);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value;
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const input = preparePromptUpdate(body);
    if (!input.ok) {
      return NextResponse.json({ error: input.message }, { status: 400 });
    }

    await dbConnect();

    const prompt = await PromptLibrary.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      input.doc,
      { new: true, runValidators: true }
    );

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json(prompt);
  } catch (error) {
    const invalid = validationErrorText(error);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    console.error('Error updating prompt:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

// PATCH - Toggle favorite (per-user, works on any prompt including public)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await readJsonObject(request, BODY_LIMITS.prompts);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    // As before, the id is used as sent; checking it is an ObjectId is Batch M (V39).
    const { id } = parsed.value as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Verify the prompt exists (own or public)
    const prompt = await PromptLibrary.findOne({
      _id: id,
      $or: [{ user_id: userId }, { is_public: true }],
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // Toggle: if favorite exists, remove it; if not, create it
    const existing = await UserFavorite.findOne({ user_id: userId, prompt_id: id });

    if (existing) {
      await UserFavorite.deleteOne({ _id: existing._id });
      return NextResponse.json({ is_favorite: false });
    } else {
      await UserFavorite.create({ user_id: userId, prompt_id: id });
      return NextResponse.json({ is_favorite: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}

// DELETE - Remove prompt (ownership verified)
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
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const prompt = await PromptLibrary.findOneAndDelete({ _id: id, user_id: userId, is_public: { $ne: true } });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}
