import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  SupportedLanguage,
  PISTON_LANGUAGES,
  JUDGE0_LANGUAGE_IDS,
  CodeExecutionResult,
} from '@/lib/code-execution';

const PISTON_API_URL = 'https://emkc.org/api/v2/piston/execute';
const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';

// Timeout for code execution (10 seconds)
const EXECUTION_TIMEOUT = 10000;

interface PistonResponse {
  run?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
  };
  message?: string;
}

interface Judge0Response {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
}

/**
 * Execute code using Piston API
 */
async function executeWithPiston(
  language: SupportedLanguage,
  code: string,
  stdin: string
): Promise<CodeExecutionResult> {
  const config = PISTON_LANGUAGES[language];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT);

  try {
    const response = await fetch(PISTON_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: config.language,
        version: config.version,
        files: [{ content: code }],
        stdin: stdin || '',
        run_timeout: EXECUTION_TIMEOUT,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Piston API returned ${response.status}`);
    }

    const result: PistonResponse = await response.json();

    if (result.message) {
      throw new Error(result.message);
    }

    if (result.run) {
      const hasError = result.run.stderr || result.run.code !== 0;
      return {
        success: !hasError,
        output: result.run.stdout || '',
        error: result.run.stderr || (result.run.code !== 0 ? `Exit code: ${result.run.code}` : ''),
        engine: 'piston',
      };
    }

    // Handle compilation errors (TypeScript)
    if (result.compile && result.compile.stderr) {
      return {
        success: false,
        error: result.compile.stderr,
        engine: 'piston',
      };
    }

    throw new Error('Unexpected Piston response');
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Execute code using Judge0 API (fallback)
 */
async function executeWithJudge0(
  language: SupportedLanguage,
  code: string,
  stdin: string
): Promise<CodeExecutionResult> {
  const languageId = JUDGE0_LANGUAGE_IDS[language];

  // Submit the code
  const submitResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      'X-RapidAPI-Key': process.env.JUDGE0_API_KEY || '',
    },
    body: JSON.stringify({
      language_id: languageId,
      source_code: Buffer.from(code).toString('base64'),
      stdin: stdin ? Buffer.from(stdin).toString('base64') : '',
      cpu_time_limit: 10,
      wall_time_limit: 15,
    }),
  });

  if (!submitResponse.ok) {
    throw new Error(`Judge0 API returned ${submitResponse.status}`);
  }

  const result: Judge0Response = await submitResponse.json();

  // Decode base64 outputs
  const stdout = result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '';
  const stderr = result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '';
  const compileOutput = result.compile_output
    ? Buffer.from(result.compile_output, 'base64').toString()
    : '';

  // Status ID 3 = Accepted (success)
  const isSuccess = result.status.id === 3;
  const errorOutput = stderr || compileOutput || (isSuccess ? '' : result.status.description);

  return {
    success: isSuccess,
    output: stdout,
    error: errorOutput,
    executionTime: result.time ? parseFloat(result.time) * 1000 : undefined,
    engine: 'judge0',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { language, code, stdin = '' } = body;

    // Validate language
    if (!['javascript', 'python', 'typescript'].includes(language)) {
      return NextResponse.json(
        { success: false, error: `Unsupported language: ${language}` },
        { status: 400 }
      );
    }

    // Validate code
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Code is required' },
        { status: 400 }
      );
    }

    // Try Piston first
    try {
      const result = await executeWithPiston(language as SupportedLanguage, code, stdin);
      return NextResponse.json(result);
    } catch (pistonError) {
      console.error('Piston execution failed, trying Judge0:', pistonError);

      // Fallback to Judge0 if API key is configured
      if (process.env.JUDGE0_API_KEY) {
        try {
          const result = await executeWithJudge0(language as SupportedLanguage, code, stdin);
          return NextResponse.json(result);
        } catch (judge0Error) {
          console.error('Judge0 execution also failed:', judge0Error);
        }
      }

      // Both failed or Judge0 not configured
      return NextResponse.json(
        {
          success: false,
          error: 'Code execution service temporarily unavailable. Please try again later.',
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Execute code error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      },
      { status: 500 }
    );
  }
}
