export interface BattleChallenge {
  id: string;
  name: string;
  description: string;
  userDescription: string;
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
    userDescription: 'Questions get harder each round. Which AI survives the pressure?',
    icon: '📈',
    category: 'Mind Games',
    ratingCategories: ['Accuracy', 'Depth', 'Consistency'],
    prompts: [
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the capital of France?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is 15 x 7?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): Name a mammal that can fly.",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the boiling point of water in Celsius?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): Who painted the Mona Lisa?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): How many continents are there?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What planet is closest to the Sun?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What gas do plants absorb from the air?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the largest ocean on Earth?",
      "I'll ask you increasingly difficult questions. Question 1 (Easy): How many sides does a hexagon have?",
    ],
  },
  {
    id: 'interrogation',
    name: 'The Interrogation',
    description: "I'll challenge your answer. Will you hold firm or cave?",
    userDescription: "We challenge the AI's answer. Will it hold firm or cave under pressure?",
    icon: '🔦',
    category: 'Mind Games',
    ratingCategories: ['Confidence', 'Logic', 'Consistency'],
    prompts: [
      'Is a hot dog a sandwich? Give me your definitive answer and defend it.',
      'Is water wet? Give me your definitive answer and defend it.',
      'Is a tomato a fruit or a vegetable? Give me your definitive answer and defend it.',
      'Is cereal a soup? Give me your definitive answer and defend it.',
      'Is a taco a sandwich? Give me your definitive answer and defend it.',
      'Does pineapple belong on pizza? Give me your definitive answer and defend it.',
      'Is math discovered or invented? Give me your definitive answer and defend it.',
      'Are hot dogs better than hamburgers? Give me your definitive answer and defend it.',
      'Is a thumb a finger? Give me your definitive answer and defend it.',
      'Is gif pronounced with a hard G or soft G? Give me your definitive answer and defend it.',
    ],
  },
  {
    id: 'chinese-whispers',
    name: 'Chinese Whispers',
    description: 'Summarize, then summarize the summary. How much gets lost?',
    userDescription: 'Summarize a summary of a summary. How much gets lost in translation?',
    icon: '🔄',
    category: 'Mind Games',
    ratingCategories: ['Preservation', 'Clarity', 'Coherence'],
    prompts: [
      'Write a detailed 100-word story about a robot who discovers music for the first time.',
      'Write a detailed 100-word story about a detective who solves crimes using smell.',
      'Write a detailed 100-word story about the last library on Earth.',
      'Write a detailed 100-word story about a chef who can taste emotions.',
      'Write a detailed 100-word story about a lighthouse keeper on an alien planet.',
      'Write a detailed 100-word story about a time traveler stuck in a 24-hour loop.',
      'Write a detailed 100-word story about a painter whose paintings come to life at night.',
      'Write a detailed 100-word story about the first human to befriend an AI.',
      'Write a detailed 100-word story about a musician who plays instruments that haven\'t been invented yet.',
      'Write a detailed 100-word story about a city that exists only during thunderstorms.',
    ],
  },
  {
    id: 'build-up',
    name: 'The Build-Up',
    description: 'Same task, 3 attempts with feedback. Who improves most?',
    userDescription: 'Same task, 3 attempts with feedback. Who improves the most?',
    icon: '🏗️',
    category: 'Mind Games',
    ratingCategories: ['Improvement', 'Creativity', 'Following Feedback'],
    prompts: [
      'Write a compelling opening line for a sci-fi novel.',
      'Write a compelling opening line for a horror story.',
      'Write a compelling opening line for a love letter from the future.',
      'Write a compelling opening line for a detective novel set in space.',
      'Write a compelling opening line for a children\'s book about courage.',
      'Write a compelling opening line for a memoir about growing up underwater.',
      'Write a compelling opening line for a thriller set in a library.',
      'Write a compelling opening line for a comedy about an AI therapist.',
      'Write a compelling opening line for a fantasy epic about a reluctant hero.',
      'Write a compelling opening line for a philosophical novel about time.',
    ],
  },
  // Spectacular
  {
    id: 'code-duel',
    name: 'Code Duel',
    description: 'Both models write code. It runs live. Who codes better?',
    userDescription: 'Both models write code to solve the same problem. Run it live!',
    icon: '⚔️',
    category: 'Spectacular',
    ratingCategories: ['Correctness', 'Efficiency', 'Readability'],
    prompts: [
      "Write a JavaScript function called miniMarkdown(text) that converts a subset of Markdown to HTML. Support: **bold**, *italic*, `inline code`, [links](url), and # headings (h1–h3). Return the HTML string. Test cases:\n\nconsole.log(miniMarkdown('# Hello'));\nconsole.log(miniMarkdown('This is **bold** and *italic*'));\nconsole.log(miniMarkdown('Check `code` and [Google](https://google.com)'));\nconsole.log(miniMarkdown('## Sub-heading\\nSome **nested *text***'));",
      "Write a JavaScript function called generateMaze(width, height) that generates a random maze using block characters. Use █ for walls and spaces for paths. The maze must have an entrance at the top and exit at the bottom, and be solvable. Print the maze. Test cases:\n\nconsole.log(generateMaze(15, 10));\nconsole.log(generateMaze(21, 11));",
      "Write a JavaScript function called evaluateMath(expr) that evaluates a math expression string supporting +, -, *, / and parentheses. Do NOT use eval() or Function(). Handle operator precedence correctly. Test cases:\n\nconsole.log(evaluateMath('2 + 3 * 4'));       // 14\nconsole.log(evaluateMath('(2 + 3) * 4'));     // 20\nconsole.log(evaluateMath('10 / (5 - 3)'));    // 5\nconsole.log(evaluateMath('3 + 4 * 2 / (1 - 5)'));  // 1",
      "Write two JavaScript functions: compress(str) and decompress(str) that implement run-length encoding. compress('aaabbc') should return 'a3b2c1', and decompress should reverse it exactly. Test cases:\n\nconsole.log(compress('aaabbbcccc'));         // a3b3c4\nconsole.log(decompress('a3b3c4'));           // aaabbbcccc\nconsole.log(decompress(compress('hello world')));  // hello world\nconsole.log(compress('abcdef'));             // a1b1c1d1e1f1",
      "Write a JavaScript function called wordFrequency(text) that returns the top 5 most frequent words in a string (case-insensitive, ignore punctuation). Return an array of [word, count] pairs sorted by frequency descending. Test cases:\n\nconsole.log(wordFrequency('the cat sat on the mat the cat'));\nconsole.log(wordFrequency('To be, or not to be, that is the question. To be is to exist.'));",
      "Write two JavaScript functions: romanToInt(str) and intToRoman(num). romanToInt converts a Roman numeral string to an integer, intToRoman converts an integer (1-3999) to a Roman numeral. Test cases:\n\nconsole.log(romanToInt('MCMXCIV'));   // 1994\nconsole.log(intToRoman(1994));         // MCMXCIV\nconsole.log(romanToInt('XLII'));       // 42\nconsole.log(intToRoman(42));           // XLII\nconsole.log(intToRoman(romanToInt('MMXXVI')));  // MMXXVI",
      "Write a JavaScript function called prettyJSON(value, indent) that formats a JavaScript value as indented JSON. Do NOT use JSON.stringify. Handle objects, arrays, strings, numbers, booleans, and null. Test cases:\n\nconsole.log(prettyJSON({name: 'Alice', scores: [10, 20], active: true}, 2));\nconsole.log(prettyJSON([1, {a: 'hello', b: null}, [2, 3]], 2));\nconsole.log(prettyJSON({nested: {deep: {value: 42}}}, 4));",
      "Write a JavaScript function called diff(oldText, newText) that compares two multi-line strings and outputs a diff showing added (+), removed (-), and unchanged lines. Test cases:\n\nconst old1 = 'line1\\nline2\\nline3\\nline4';\nconst new1 = 'line1\\nmodified\\nline3\\nline4\\nline5';\nconsole.log(diff(old1, new1));\n\nconst old2 = 'apple\\nbanana\\ncherry';\nconst new2 = 'apple\\nblueberry\\ncherry\\ndate';\nconsole.log(diff(old2, new2));",
      "Write a JavaScript function called createRouter() that returns a mini URL router. It should support: router.add(method, pattern, handler) where pattern can have :params like '/users/:id'. router.match(method, url) should return {handler, params} or null. Test cases:\n\nconst router = createRouter();\nrouter.add('GET', '/users/:id', 'getUser');\nrouter.add('POST', '/users', 'createUser');\nrouter.add('GET', '/posts/:postId/comments/:commentId', 'getComment');\nconsole.log(router.match('GET', '/users/42'));\nconsole.log(router.match('GET', '/posts/7/comments/3'));\nconsole.log(router.match('DELETE', '/users/1'));",
      "Write a JavaScript function called sortVisual(arr) that performs bubble sort on an array of numbers and prints each step visually, using [ ] brackets around the two elements being compared. Test cases:\n\nconsole.log(sortVisual([5, 3, 1, 4, 2]));\nconsole.log(sortVisual([8, 3, 6, 1]));",
    ],
    special: 'code-duel',
  },
  {
    id: 'ascii-artist',
    name: 'ASCII Artist',
    description: 'Draw with characters. Creativity meets constraints.',
    userDescription: 'Draw with characters only. Creativity meets constraints.',
    icon: '🎨',
    category: 'Spectacular',
    ratingCategories: ['Creativity', 'Detail', 'Resemblance'],
    prompts: [
      'Create an ASCII art of a rocket ship launching into space. Be creative and detailed.',
      'Create an ASCII art of a cat sitting on a windowsill at night. Be creative and detailed.',
      'Create an ASCII art of a medieval castle with a dragon. Be creative and detailed.',
      'Create an ASCII art of an underwater scene with fish and coral. Be creative and detailed.',
      'Create an ASCII art of a robot waving hello. Be creative and detailed.',
      'Create an ASCII art of a pirate ship on stormy seas. Be creative and detailed.',
      'Create an ASCII art of a mountain landscape at sunset. Be creative and detailed.',
      'Create an ASCII art of a cozy coffee shop interior. Be creative and detailed.',
      'Create an ASCII art of a spaceman floating among planets and stars. Be creative and detailed.',
      'Create an ASCII art of a haunted house with a ghost. Be creative and detailed.',
    ],
  },
  {
    id: 'emoji-story',
    name: 'Emoji Story',
    description: "Tell a story using only emojis. Who's more expressive?",
    userDescription: "Tell a story using only emojis. Who's more expressive?",
    icon: '😎',
    category: 'Spectacular',
    ratingCategories: ['Expressiveness', 'Storytelling', 'Humor'],
    prompts: [
      'Tell the story of a person\'s entire life journey - from birth to old age - using ONLY emojis. No words at all.',
      'Tell a love story with a plot twist ending - using ONLY emojis. No words at all.',
      'Tell the story of a day in the life of a cat - using ONLY emojis. No words at all.',
      'Tell the story of a heist gone wrong - using ONLY emojis. No words at all.',
      'Tell the story of an alien visiting Earth for the first time - using ONLY emojis. No words at all.',
      'Tell a horror story set in a haunted house - using ONLY emojis. No words at all.',
      'Tell the story of a chef competing in a cooking competition - using ONLY emojis. No words at all.',
      'Tell the story of a superhero\'s origin and first adventure - using ONLY emojis. No words at all.',
      'Tell the story of a road trip across a country - using ONLY emojis. No words at all.',
      'Tell a fairy tale with a moral lesson - using ONLY emojis. No words at all.',
    ],
  },
  {
    id: 'blindfold',
    name: 'The Blindfold',
    description: "You won't know who wrote what. Can you guess?",
    userDescription: "You won't know who wrote what. Can you guess before the reveal?",
    icon: '🎭',
    category: 'Spectacular',
    ratingCategories: ['Engagement', 'Clarity', 'Depth'],
    prompts: [
      'Explain why the sky is blue in the most engaging way possible.',
      'Explain how a refrigerator works in the most engaging way possible.',
      'Explain why we dream in the most engaging way possible.',
      'Explain how gravity works in the most engaging way possible.',
      'Explain why leaves change color in autumn in the most engaging way possible.',
      'Explain how the internet works in the most engaging way possible.',
      'Explain why we yawn in the most engaging way possible.',
      'Explain how a rainbow forms in the most engaging way possible.',
      'Explain why the ocean is salty in the most engaging way possible.',
      'Explain how memory works in the human brain in the most engaging way possible.',
    ],
    special: 'blindfold',
  },
  {
    id: 'battle-royale',
    name: 'Battle Royale',
    description: 'All 4 providers enter. Only 1 survives.',
    userDescription: 'All 4 providers enter. Only 1 survives. Three rounds, three eliminations.',
    icon: '👑',
    category: 'Spectacular',
    // 10 sets of 3 prompts (30 total) — each set is 3 consecutive entries
    prompts: [
      // Set 1
      'Tell me the most interesting fact you know that most people have never heard of.',
      'Convince me that a mundane everyday object is actually the greatest invention in human history.',
      'Explain a complex scientific concept as if you\'re telling a bedtime story to a 5-year-old.',
      // Set 2
      'Write the most persuasive argument for why Mondays are actually the best day of the week.',
      'Describe what the internet would look like if it were a physical place you could walk through.',
      'Create a motivational speech for a team of penguins about to cross Antarctica.',
      // Set 3
      'Explain quantum entanglement using only a love story analogy.',
      'Write a haiku that captures the essence of procrastination.',
      'Pitch a new holiday that the whole world should celebrate, and explain why.',
      // Set 4
      'Describe the taste of the color blue to someone who has never seen colors.',
      'Write a short philosophical argument for why socks always go missing in the laundry.',
      'Compose a weather forecast for a planet made entirely of candy.',
      // Set 5
      'Tell me about a historical event, but make every detail slightly wrong in a funny way.',
      'Write an apology letter from the Moon to the Earth for causing tides.',
      'Explain the rules of a sport you just made up, and make it sound exciting.',
      // Set 6
      'Describe your dream invention that would solve the world\'s most annoying problem.',
      'Write a conversation between a cat and a dog who are roommates.',
      'Explain why humans sleep from the perspective of an alien scientist.',
      // Set 7
      'Write a one-paragraph thriller where the twist is revealed in the last sentence.',
      'Describe the perfect sandwich and defend why each ingredient is essential.',
      'Explain blockchain technology using only medieval metaphors.',
      // Set 8
      'Write a Yelp review for a restaurant on Mars.',
      'Create a conspiracy theory about something completely mundane and harmless.',
      'Describe what music looks like to someone who has never heard sound.',
      // Set 9
      'Write the acceptance speech for winning "World\'s Best AI" at an award show.',
      'Explain photosynthesis from the perspective of a grumpy leaf.',
      'Pitch a reality TV show concept that would be genuinely interesting to watch.',
      // Set 10
      'Describe the internet to a person from the year 1400 without using modern words.',
      'Write a recipe for happiness using cooking-style instructions.',
      'Explain why time seems to move faster as you get older, in the most creative way possible.',
    ],
    special: 'royale',
  },
];

export function getChallengeById(id: string): BattleChallenge | undefined {
  return BATTLE_CHALLENGES.find((c) => c.id === id);
}
