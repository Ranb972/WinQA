import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/lib/mongodb';
import PromptLibrary from '@/models/PromptLibrary';
import { sanitizeQueryParam, pickAllowedFields } from '@/lib/security';

const ALLOWED_PUT_FIELDS = ['title', 'bad_prompt_example', 'good_prompt_example', 'explanation', 'tags', 'is_favorite'];

// GET - List all prompts for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const favorite = searchParams.get('favorite');

    const filter: Record<string, unknown> = { user_id: userId };
    if (tag) filter.tags = sanitizeQueryParam(tag);
    if (favorite === 'true') filter.is_favorite = true;

    let prompts = await PromptLibrary.find(filter).sort({ created_at: -1 });

    // Legacy migration: claim unowned docs on first empty result
    if (prompts.length === 0) {
      const legacyCount = await PromptLibrary.countDocuments({ user_id: { $exists: false } });
      if (legacyCount > 0) {
        await PromptLibrary.updateMany({ user_id: { $exists: false } }, { $set: { user_id: userId } });
        prompts = await PromptLibrary.find(filter).sort({ created_at: -1 });
      }
    }

    return NextResponse.json(prompts);
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
      is_favorite: body.is_favorite || false,
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
      { _id: id, user_id: userId },
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

// PATCH - Toggle favorite (ownership verified)
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

    const prompt = await PromptLibrary.findOne({ _id: id, user_id: userId });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    prompt.is_favorite = !prompt.is_favorite;
    await prompt.save();

    return NextResponse.json(prompt);
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

    const prompt = await PromptLibrary.findOneAndDelete({ _id: id, user_id: userId });

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
