export function GET() {
  const content = `# WinQA

> AI Testing Playground — Compare AI models, test prompts, track hallucinations, and build your prompt engineering knowledge base. Free developer tool for QA professionals.

WinQA is a free, web-based AI testing playground that lets developers and QA professionals compare responses from multiple AI providers (Cohere, Google Gemini, Groq, and OpenRouter) side-by-side. The platform includes 9 unique challenge types in its AI Battle Arena, a code execution lab supporting JavaScript, Python, and TypeScript, a hallucination and bug tracker, and a curated prompt engineering library.

## Core Features

- [Chat Lab](https://winqa.ai/chat-lab): Compare AI model responses side-by-side across Cohere, Google Gemini, Groq, and OpenRouter providers
- [AI Battle Arena](https://winqa.ai/battle): Pit AI models against each other in 9 challenge types including Escalation, Code Duel, Chinese Whispers, The Interrogation, Blindfold Test, Emoji War, and Battle Royale
- [Code Testing Lab](https://winqa.ai/code-testing): Execute and test JavaScript, Python, and TypeScript code with AI assistance
- [Test Cases](https://winqa.ai/test-cases): Create and manage test cases for AI model evaluation
- [Bug Tracker](https://winqa.ai/bugs): Track AI hallucinations and model bugs with structured reports categorized by type and severity
- [Prompt Library](https://winqa.ai/prompts): Curated collection of effective prompts organized by category with best practices
- [Insights](https://winqa.ai/insights): Pattern discovery and trend tracking from AI testing sessions

## Pages

- [Homepage](https://winqa.ai): Overview of all platform capabilities
- [Privacy Policy](https://winqa.ai/privacy): How WinQA handles your data
- [Terms of Service](https://winqa.ai/terms): Usage terms and conditions
- [Sitemap](https://winqa.ai/sitemap.xml): Complete page index
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
