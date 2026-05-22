export function GET() {
  const content = `# WinQA

> AI Testing Playground — Compare AI models, test prompts, track hallucinations, and build your prompt engineering knowledge base. Free developer tool for QA professionals.

WinQA is a free, web-based AI testing playground that lets developers and QA professionals compare responses from multiple AI providers (Cohere, Google Gemini, Groq, and OpenRouter) side-by-side. The platform includes 9 unique challenge types in its AI Battle Arena, a code execution lab supporting JavaScript, Python, and TypeScript, a hallucination and bug tracker, and a curated prompt engineering library.

## Pages

- [Homepage](https://winqa.ai): Overview of all platform capabilities
- [About](https://winqa.ai/about): AI testing playground for comparing LLM models side-by-side, running battle challenges, testing code, documenting failures, and building prompt engineering knowledge
- [FAQ](https://winqa.ai/faq): Common questions about WinQA — what it is, how it works, pricing, supported AI models, data privacy, and how to get started
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
