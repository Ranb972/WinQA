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
      "Write a JavaScript function called isPalindrome(str) that returns true if the string is a palindrome (ignoring spaces, punctuation, and capitalization). Then run these test cases:\n\nconsole.log(isPalindrome('racecar'));  // true\nconsole.log(isPalindrome('hello'));    // false\nconsole.log(isPalindrome('A man a plan a canal Panama'));  // true",
      "Write a JavaScript function called fizzbuzz(n) that returns an array from 1 to n where multiples of 3 are 'Fizz', multiples of 5 are 'Buzz', and multiples of both are 'FizzBuzz'. Include these test cases:\n\nconsole.log(fizzbuzz(15));\nconsole.log(fizzbuzz(5));\nconsole.log(fizzbuzz(1));",
      "Write a JavaScript function called flattenArray(arr) that flattens a deeply nested array into a single level. Include these test cases:\n\nconsole.log(flattenArray([1, [2, [3, [4]], 5]]));\nconsole.log(flattenArray([[1, 2], [3, [4, 5]]]));\nconsole.log(flattenArray([1, [], [2, []]]));",
      "Write a JavaScript function called caesarCipher(str, shift) that encrypts a string using a Caesar cipher. Only shift letters, preserve case and non-alpha characters. Test cases:\n\nconsole.log(caesarCipher('Hello, World!', 3));  // Khoor, Zruog!\nconsole.log(caesarCipher('abc', 1));  // bcd\nconsole.log(caesarCipher('xyz', 3));  // abc",
      "Write a JavaScript function called debounce(fn, delay) that returns a debounced version of the function. Demonstrate it works with:\n\nlet count = 0;\nconst inc = debounce(() => { count++; console.log('count:', count); }, 100);\ninc(); inc(); inc();\nsetTimeout(() => console.log('final count:', count), 200);",
      "Write a JavaScript function called deepEqual(a, b) that checks if two values are deeply equal (supports objects, arrays, and primitives). Test cases:\n\nconsole.log(deepEqual({a: 1, b: {c: 2}}, {a: 1, b: {c: 2}}));  // true\nconsole.log(deepEqual([1, [2, 3]], [1, [2, 3]]));  // true\nconsole.log(deepEqual({a: 1}, {a: 2}));  // false",
      "Write a JavaScript function called groupBy(arr, key) that groups an array of objects by a given key. Test cases:\n\nconst people = [{name: 'Alice', age: 25}, {name: 'Bob', age: 30}, {name: 'Charlie', age: 25}];\nconsole.log(groupBy(people, 'age'));\nconsole.log(groupBy([{type: 'a', v: 1}, {type: 'b', v: 2}, {type: 'a', v: 3}], 'type'));",
      "Write a JavaScript function called memoize(fn) that caches results of expensive function calls. Test it:\n\nlet callCount = 0;\nconst expensive = memoize((n) => { callCount++; return n * n; });\nconsole.log(expensive(5));  // 25\nconsole.log(expensive(5));  // 25 (cached)\nconsole.log('calls:', callCount);  // 1",
      "Write a JavaScript function called chunk(arr, size) that splits an array into chunks of the given size. Test cases:\n\nconsole.log(chunk([1,2,3,4,5], 2));  // [[1,2],[3,4],[5]]\nconsole.log(chunk([1,2,3,4,5,6], 3));  // [[1,2,3],[4,5,6]]\nconsole.log(chunk([1], 5));  // [[1]]",
      "Write a JavaScript function called pipe(...fns) that composes functions left-to-right. Test it:\n\nconst add1 = x => x + 1;\nconst double = x => x * 2;\nconst square = x => x * x;\nconsole.log(pipe(add1, double)(3));  // 8\nconsole.log(pipe(add1, double, square)(3));  // 64",
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
