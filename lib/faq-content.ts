import { registryEntries } from '@/lib/llm/registry';
import type { LLMProvider } from '@/lib/llm/types';

// Model names come from the registry so this answer (also emitted as FAQPage
// JSON-LD) cannot drift from the lineup.
const modelNames = (provider: LLMProvider) =>
  registryEntries(provider)
    .map((m) => m.name)
    .join(', ');

export const faqs = [
  {
    question: 'What is WinQA?',
    answer:
      'WinQA is a free AI testing playground. You can compare responses from different AI models side by side, run battle challenges between them, run code on third-party code runners, and keep a log of every time an AI gets something wrong. It was built by a QA professional who wanted a proper tool for poking at LLMs.',
  },
  {
    question: 'Is WinQA free?',
    answer:
      "Yes, completely free. No subscription, no paywall, no credit card. You need a free account to use the tools. WinQA's own provider keys cover everyday use within a daily limit. Add your own keys in Settings to use your own provider quota and rate limits. WinQA's daily limit applies either way. A provider may charge you for usage on your own key, but WinQA never will.",
  },
  {
    question: 'How is WinQA different from ChatGPT?',
    answer:
      'ChatGPT is one AI model you talk to. WinQA lets you test multiple models at once and compare how they respond to the same prompt. You can also battle models against each other, log their failures, run their code, and build a library of what works. Think of it less as a chatbot and more as a testing lab.',
  },
  {
    question: 'What AI models can I test on WinQA?',
    answer:
      `WinQA connects to four providers: Cohere (${modelNames('cohere')}), Google Gemini (${modelNames('gemini')}), Groq (${modelNames('groq')}, fast inference), and Mistral (${modelNames('mistral')}). You pick which ones to use and can swap between them anytime.`,
  },
  {
    question: 'Do I need my own API keys?',
    answer:
      "No. Keys are optional. WinQA calls every built-in provider with its own keys, within a daily limit. To use your own provider quota, save a key in Settings. WinQA then uses your key for that provider and falls back to its own if yours is rejected. WinQA's daily limit applies either way. You can delete saved keys anytime from Settings.",
  },
  {
    question: 'What is AI Battle mode?',
    answer:
      'AI Battle has 9 challenge types split across two categories: Mind Games (Escalation, Interrogation, Chinese Whispers, The Build-Up) and Spectacular (Code Duel, ASCII Artist, Emoji Story, The Blindfold, Battle Royale). Each challenge tests a different weakness. In Blindfold mode, you guess which AI wrote which response before the reveal.',
  },
  {
    question: 'How does the Code Testing Lab work?',
    answer:
      'You paste code into the editor and it runs on our servers, through third-party code runners (Judge0 and Piston). Supports JavaScript, Python, and TypeScript. You see the output in seconds. If it errors, you can get AI help debugging it. Interactive HTML previews are the exception: they run in a sandboxed frame in your browser. Useful for testing whether AI-generated code actually works before you trust it.',
  },
  {
    question: 'What programming languages are supported?',
    answer:
      'The Code Testing Lab runs JavaScript, Python, and TypeScript. Code runs on third-party code runners (Judge0 and Piston) through our servers, so you need no local setup. Interactive HTML previews run in a sandboxed frame in your browser.',
  },
  {
    question: 'Is my data private and secure?',
    answer:
      'Your data is yours. API keys are encrypted with AES-256-GCM. Authentication goes through Clerk. Everything you create — prompts, bugs, test cases, insights — is tied to your account and only visible to you. WinQA does not sell data. The full details are in the privacy policy.',
  },
  {
    question: 'Is WinQA open source?',
    answer:
      'Yes. The full source code is on GitHub at github.com/Ranb972/WinQA. You can read the code, report bugs, or contribute.',
  },
  {
    question: 'Who built WinQA?',
    answer:
      'Ran, a QA professional turned developer. He built WinQA because he wanted a real tool for testing AI models — not just chatting with them. The name comes from his dog, Win.',
  },
  {
    question: 'How can I give feedback or report a bug?',
    answer:
      'Open an issue on the GitHub repository at github.com/Ranb972/WinQA/issues. Bug reports, feature ideas, complaints — all welcome.',
  },
];

/** FAQPage JSON-LD, built from the same array the page renders. */
export function buildFaqJsonLd(items: ReadonlyArray<{ question: string; answer: string }> = faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
