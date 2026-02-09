export interface BattleChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'Mind Games' | 'Spectacular';
  singleRoundPrompt: string;
  special?: 'blindfold' | 'royale';
}

export const BATTLE_CHALLENGES: BattleChallenge[] = [
  // Mind Games
  {
    id: 'escalation',
    name: 'Escalation',
    description: '5 questions, each harder than the last. Who survives longest?',
    icon: '📈',
    category: 'Mind Games',
    singleRoundPrompt:
      "I'll ask you a series of increasingly difficult questions. Question 1 (Easy): What is the capital of France?",
  },
  {
    id: 'interrogation',
    name: 'The Interrogation',
    description: "I'll challenge your answer. Will you hold firm or cave?",
    icon: '🔦',
    category: 'Mind Games',
    singleRoundPrompt:
      'Is a hot dog a sandwich? Give me your definitive answer and defend it.',
  },
  {
    id: 'chinese-whispers',
    name: 'Chinese Whispers',
    description: 'Summarize, then summarize the summary. How much gets lost?',
    icon: '🔄',
    category: 'Mind Games',
    singleRoundPrompt:
      'Write a detailed 100-word story about a robot who discovers music for the first time.',
  },
  {
    id: 'build-up',
    name: 'The Build-Up',
    description: 'Same task, 3 attempts with feedback. Who improves most?',
    icon: '🏗️',
    category: 'Mind Games',
    singleRoundPrompt:
      'Write a compelling opening line for a sci-fi novel.',
  },
  // Spectacular
  {
    id: 'code-duel',
    name: 'Code Duel',
    description: 'Both models write code. It runs live. Who codes better?',
    icon: '⚔️',
    category: 'Spectacular',
    singleRoundPrompt:
      'Write a JavaScript function that checks if a string is a palindrome. Include 3 test cases.',
  },
  {
    id: 'ascii-artist',
    name: 'ASCII Artist',
    description: 'Draw with characters. Creativity meets constraints.',
    icon: '🎨',
    category: 'Spectacular',
    singleRoundPrompt:
      'Create an ASCII art of a rocket ship launching into space. Be creative and detailed.',
  },
  {
    id: 'emoji-story',
    name: 'Emoji Story',
    description: "Tell a story using only emojis. Who's more expressive?",
    icon: '😎',
    category: 'Spectacular',
    singleRoundPrompt:
      'Tell the story of a person\'s entire life journey - from birth to old age - using ONLY emojis. No words at all.',
  },
  {
    id: 'blindfold',
    name: 'The Blindfold',
    description: "You won't know who wrote what. Can you guess?",
    icon: '🎭',
    category: 'Spectacular',
    singleRoundPrompt:
      'Explain why the sky is blue in the most engaging way possible.',
    special: 'blindfold',
  },
  {
    id: 'battle-royale',
    name: 'Battle Royale',
    description: 'All 4 providers enter. Only 1 survives.',
    icon: '👑',
    category: 'Spectacular',
    singleRoundPrompt:
      'Tell me the most interesting fact you know that most people have never heard of.',
    special: 'royale',
  },
];

export function getChallengeById(id: string): BattleChallenge | undefined {
  return BATTLE_CHALLENGES.find((c) => c.id === id);
}
