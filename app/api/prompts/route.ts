import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import PromptLibrary from '@/models/PromptLibrary';

// GET - List all prompts
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const favorite = searchParams.get('favorite');

    const filter: Record<string, unknown> = {};
    if (tag) filter.tags = tag;
    if (favorite === 'true') filter.is_favorite = true;

    const prompts = await PromptLibrary.find(filter).sort({ created_at: -1 });
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
    await dbConnect();
    const body = await request.json();

    const prompt = await PromptLibrary.create({
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

// PUT - Update prompt
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const prompt = await PromptLibrary.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

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

// PATCH - Toggle favorite
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const prompt = await PromptLibrary.findById(id);

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

// DELETE - Remove prompt
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Prompt ID is required' },
        { status: 400 }
      );
    }

    const prompt = await PromptLibrary.findByIdAndDelete(id);

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
