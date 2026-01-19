import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import TestCase from '@/models/TestCase';

// GET - List all test cases
export async function GET() {
  try {
    await dbConnect();
    const testCases = await TestCase.find({}).sort({ created_at: -1 });
    return NextResponse.json(testCases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test cases' },
      { status: 500 }
    );
  }
}

// POST - Create new test case
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();

    const testCase = await TestCase.create({
      title: body.title,
      description: body.description,
      initial_prompt: body.initial_prompt,
      expected_outcome: body.expected_outcome,
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json(
      { error: 'Failed to create test case' },
      { status: 500 }
    );
  }
}

// PUT - Update test case
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    const testCase = await TestCase.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!testCase) {
      return NextResponse.json(
        { error: 'Test case not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json(
      { error: 'Failed to update test case' },
      { status: 500 }
    );
  }
}

// DELETE - Remove test case
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Test case ID is required' },
        { status: 400 }
      );
    }

    const testCase = await TestCase.findByIdAndDelete(id);

    if (!testCase) {
      return NextResponse.json(
        { error: 'Test case not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Test case deleted successfully' });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json(
      { error: 'Failed to delete test case' },
      { status: 500 }
    );
  }
}
