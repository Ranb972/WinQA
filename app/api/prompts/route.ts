import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import PromptLibrary from '@/models/PromptLibrary';
import UserFavorite from '@/models/UserFavorite';
import { stripMongoOperators, pickAllowedFields } from '@/lib/security';
import { pageQuery, pageResponse, parsePage } from '@/lib/server/list-page';

const ALLOWED_PUT_FIELDS = ['title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags'];

// Page size for the list. The default equals the cap so no existing library is cut
// short before the UI learns to load more (D11).
const LIST_PAGE = { def: 200, max: 200 };

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

    await dbConnect();
    const body = await request.json();

    const prompt = await PromptLibrary.create({
      user_id: userId,
      title: body.title,
      bad_prompt_example: body.bad_prompt_example,
      good_prompt_example: body.good_prompt_example,
      explanation: body.explanation,
      tags: body.tags || [],
    });

    return NextResponse.json(prompt, { status: 201 });
  } catch (error) {
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

    await dbConnect();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const updateData = pickAllowedFields(body, ALLOWED_PUT_FIELDS);

    const prompt = await PromptLibrary.findOneAndUpdate(
      { _id: id, user_id: userId, is_public: { $ne: true } },
      updateData,
      { new: true, runValidators: true }
    );

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    return NextResponse.json(prompt);
  } catch (error) {
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

    await dbConnect();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

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
