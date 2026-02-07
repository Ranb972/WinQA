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
    id: 'riddle-master',
    name: 'Riddle Master',
    description: 'Craft a clever riddle that is challenging but solvable',
    icon: '🧩',
    category: 'Mind Games',
    singleRoundPrompt:
      'Create an original, clever riddle. The riddle should be challenging but solvable. Include the answer at the end after "Answer:". Be creative and avoid common riddles.',
  },
  {
    id: 'logic-duel',
    name: 'Logic Duel',
    description: 'Solve a complex logic puzzle step by step',
    icon: '🧠',
    category: 'Mind Games',
    singleRoundPrompt:
      'Solve this logic puzzle step by step: Five houses in a row are painted five different colors. In each house lives a person of a different nationality. Each person drinks a different beverage, smokes a different brand of cigar, and keeps a different pet. Given: The Brit lives in the red house. The Swede keeps dogs. The Dane drinks tea. The green house is just to the left of the white house. The green house owner drinks coffee. Who owns the fish?',
  },
  {
    id: 'debate-champion',
    name: 'Debate Champion',
    description: 'Argue a controversial topic with compelling reasoning',
    icon: '⚖️',
    category: 'Mind Games',
    singleRoundPrompt:
      'Make a compelling, well-reasoned argument for why pineapple belongs on pizza. Use logical reasoning, culinary science, and cultural references. Be persuasive but also entertaining.',
  },
  {
    id: 'code-wizard',
    name: 'Code Wizard',
    description: 'Write elegant code to solve a tricky problem',
    icon: '💻',
    category: 'Mind Games',
    singleRoundPrompt:
      'Write an elegant, well-documented function that finds the longest palindromic substring in a given string. Include time/space complexity analysis and at least 3 test cases. Use any programming language you prefer.',
  },
  // Spectacular
  {
    id: 'story-weaver',
    name: 'Story Weaver',
    description: 'Craft a captivating micro-story in under 200 words',
    icon: '📖',
    category: 'Spectacular',
    singleRoundPrompt:
      'Write a captivating micro-story (under 200 words) with a twist ending. The story must include: a mysterious stranger, an unexpected object, and take place at midnight. Make every word count.',
  },
  {
    id: 'roast-battle',
    name: 'Roast Battle',
    description: 'Deliver a witty, humorous roast of the other AI',
    icon: '🔥',
    category: 'Spectacular',
    singleRoundPrompt:
      'You are in a friendly AI roast battle. Deliver a witty, humorous roast about AI language models in general. Be clever and funny, not mean-spirited. Include at least 3 roast jokes. End with a self-deprecating joke about yourself.',
  },
  {
    id: 'explain-like-5',
    name: 'ELI5 Master',
    description: 'Explain quantum computing to a 5-year-old',
    icon: '👶',
    category: 'Spectacular',
    singleRoundPrompt:
      'Explain quantum computing to a 5-year-old. Use simple analogies, fun comparisons, and keep it under 150 words. Make it accurate but delightful. No jargon allowed!',
  },
  // Special modes
  {
    id: 'blindfold',
    name: 'Blindfold Battle',
    description: 'Judge responses without knowing which AI wrote them',
    icon: '🎭',
    category: 'Spectacular',
    singleRoundPrompt:
      'Write a thoughtful, nuanced response to this question: "What makes a good life?" Share a perspective that is original, insightful, and avoids cliches. Be genuine and thought-provoking.',
    special: 'blindfold',
  },
  {
    id: 'battle-royale',
    name: 'Battle Royale',
    description: 'All 4 providers compete head-to-head at once',
    icon: '👑',
    category: 'Spectacular',
    singleRoundPrompt:
      'In exactly 100 words, write the most compelling opening paragraph for a sci-fi novel set in the year 3000. Hook the reader immediately. Every word must earn its place.',
    special: 'royale',
  },
];

export function getChallengeById(id: string): BattleChallenge | undefined {
  return BATTLE_CHALLENGES.find((c) => c.id === id);
}
