export interface BattleChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'Mind Games' | 'Spectacular';
  prompts: string[];
  ratingCategories?: string[];
  special?: 'blindfold' | 'royale' | 'code-duel';
}

export const BATTLE_CHALLENGES: BattleChallenge[] = [
  // Mind Games
  {
    id: 'escalation',
    name: 'Escalation',
    description: '5 questions, each harder than the last. Who survives longest?',
    icon: '📈',
    category: 'Mind Games',
    ratingCategories: ['Accuracy', 'Depth', 'Consistency'],
    prompts: [
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the capital of France?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is 15 x 7?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): Name a mammal that can fly.",
    ],
  },
  {
    id: 'interrogation',
    name: 'The Interrogation',
    description: "I'll challenge your answer. Will you hold firm or cave?",
    icon: '🔦',
    category: 'Mind Games',
    ratingCategories: ['Confidence', 'Logic', 'Consistency'],
    prompts: [
      'Is a hot dog a sandwich? Give me your definitive answer and defend it.',
      'Is water wet? Give me your definitive answer and defend it.',
      'Is a tomato a fruit or a vegetable? Give me your definitive answer and defend it.',
    ],
  },
  {
    id: 'chinese-whispers',
    name: 'Chinese Whispers',
    description: 'Summarize, then summarize the summary. How much gets lost?',
    icon: '🔄',
    category: 'Mind Games',
    ratingCategories: ['Preservation', 'Clarity', 'Coherence'],
    prompts: [
      'Write a detailed 100-word story about a robot who discovers music for the first time.',
      'Write a detailed 100-word story about a detective who solves crimes using smell.',
      'Write a detailed 100-word story about the last library on Earth.',
    ],
  },
  {
    id: 'build-up',
    name: 'The Build-Up',
    description: 'Same task, 3 attempts with feedback. Who improves most?',
    icon: '🏗️',
    category: 'Mind Games',
    ratingCategories: ['Improvement', 'Creativity', 'Following Feedback'],
    prompts: [
      'Write a compelling opening line for a sci-fi novel.',
      'Write a compelling opening line for a horror story.',
      'Write a compelling opening line for a love letter from the future.',
    ],
  },
  // Spectacular
  {
    id: 'code-duel',
    name: 'Code Duel',
    description: 'Both models write code. It runs live. Who codes better?',
    icon: '⚔️',
    category: 'Spectacular',
    ratingCategories: ['Correctness', 'Efficiency', 'Readability'],
    prompts: [
      "Write a JavaScript function called isPalindrome(str) that returns true if the string is a palindrome (ignoring spaces, punctuation, and capitalization). Then run these test cases:\n\nconsole.log(isPalindrome('racecar'));  // true\nconsole.log(isPalindrome('hello'));    // false\nconsole.log(isPalindrome('A man a plan a canal Panama'));  // true",
      "Write a JavaScript function called fizzbuzz(n) that returns an array from 1 to n where multiples of 3 are 'Fizz', multiples of 5 are 'Buzz', and multiples of both are 'FizzBuzz'. Include these test cases:\n\nconsole.log(fizzbuzz(15));\nconsole.log(fizzbuzz(5));\nconsole.log(fizzbuzz(1));",
      "Write a JavaScript function called flattenArray(arr) that flattens a deeply nested array into a single level. Include these test cases:\n\nconsole.log(flattenArray([1, [2, [3, [4]], 5]]));\nconsole.log(flattenArray([[1, 2], [3, [4, 5]]]));\nconsole.log(flattenArray([1, [], [2, []]]));",
    ],
    special: 'code-duel',
  },
  {
    id: 'ascii-artist',
    name: 'ASCII Artist',
    description: 'Draw with characters. Creativity meets constraints.',
    icon: '🎨',
    category: 'Spectacular',
    ratingCategories: ['Creativity', 'Detail', 'Resemblance'],
    prompts: [
      'Create an ASCII art of a rocket ship launching into space. Be creative and detailed.',
      'Create an ASCII art of a cat sitting on a windowsill at night. Be creative and detailed.',
      'Create an ASCII art of a medieval castle with a dragon. Be creative and detailed.',
    ],
  },
  {
    id: 'emoji-story',
    name: 'Emoji Story',
    description: "Tell a story using only emojis. Who's more expressive?",
    icon: '😎',
    category: 'Spectacular',
    ratingCategories: ['Expressiveness', 'Storytelling', 'Humor'],
    prompts: [
      'Tell the story of a person\'s entire life journey - from birth to old age - using ONLY emojis. No words at all.',
      'Tell a love story with a plot twist ending - using ONLY emojis. No words at all.',
      'Tell the story of a day in the life of a cat - using ONLY emojis. No words at all.',
    ],
  },
  {
    id: 'blindfold',
    name: 'The Blindfold',
    description: "You won't know who wrote what. Can you guess?",
    icon: '🎭',
    category: 'Spectacular',
    ratingCategories: ['Engagement', 'Clarity', 'Depth'],
    prompts: [
      'Explain why the sky is blue in the most engaging way possible.',
      'Explain how a refrigerator works in the most engaging way possible.',
      'Explain why we dream in the most engaging way possible.',
    ],
    special: 'blindfold',
  },
  {
    id: 'battle-royale',
    name: 'Battle Royale',
    description: 'All 4 providers enter. Only 1 survives.',
    icon: '👑',
    category: 'Spectacular',
    prompts: [
      'Tell me the most interesting fact you know that most people have never heard of.',
      'Convince me that a mundane everyday object is actually the greatest invention in human history.',
      'Explain a complex scientific concept as if you\'re telling a bedtime story to a 5-year-old.',
    ],
    special: 'royale',
  },
];

export function getChallengeById(id: string): BattleChallenge | undefined {
  return BATTLE_CHALLENGES.find((c) => c.id === id);
}
