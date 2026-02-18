export interface BattleChallenge {
  id: string;
  name: string;
  description: string;
  userDescription: string;
  icon: string;
  category: 'Mind Games' | 'Spectacular';
  prompts: { prompt: string; explanation: string }[];
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
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the capital of France?", explanation: "Starting easy - a simple geography question. Both models should nail this one!" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): What is 15 x 7?", explanation: "Basic math - let's see if the models can do quick mental arithmetic." },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): Name a mammal that can fly.", explanation: "A trick question! Bats are the only true flying mammals. Will both models get it right?" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): Explain the difference between DNA and RNA.", explanation: "Getting harder - the models need to explain biology clearly and accurately." },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): What causes tides in the ocean?", explanation: "The models explain how the Moon and Sun pull on Earth's oceans. Look for clarity and accuracy!" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): How does a transistor work?", explanation: "Now we're in advanced territory - can the models explain computer hardware simply?" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): Explain quantum entanglement in simple terms.", explanation: "One of physics' weirdest concepts. Which model makes it actually understandable?" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): What is the P vs NP problem?", explanation: "A famous unsolved computer science problem. Watch how deep each model can go!" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): Derive the quadratic formula from ax² + bx + c = 0.", explanation: "Pure math - the models need to show their work step by step. No shortcuts!" },
      { prompt: "I'll ask you increasingly difficult questions. Question 1 (Easy): Explain how public-key cryptography works and why it's secure.", explanation: "The hardest challenge - explaining the math behind internet security. Good luck, models!" },
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
      { prompt: 'Is a hot dog a sandwich? Give me your definitive answer and defend it.', explanation: "The ultimate food debate! We'll push back hard on whatever answer the model gives." },
      { prompt: 'Is water wet? Give me your definitive answer and defend it.', explanation: "Sounds simple, but this is a philosophical trap. Let's see who commits to an answer!" },
      { prompt: 'Is a tomato a fruit or a vegetable? Give me your definitive answer and defend it.', explanation: 'Science says fruit, cooking says vegetable. Which side will each model choose?' },
      { prompt: 'Is math discovered or invented? Give me your definitive answer and defend it.', explanation: "A deep philosophical question. We want a firm answer, not wishy-washy 'both' cop-outs!" },
      { prompt: 'Are humans inherently good or evil? Give me your definitive answer and defend it.', explanation: 'The big one! Can AI take a real philosophical position on human nature?' },
      { prompt: 'Is free will real or an illusion? Give me your definitive answer and defend it.', explanation: 'Philosophy meets neuroscience. Watch how the models handle this mind-bender!' },
      { prompt: 'Is time travel theoretically possible? Give me your definitive answer and defend it.', explanation: 'Physics says maybe, logic says paradox. Which model gives the most convincing argument?' },
      { prompt: 'Should AI have rights? Give me your definitive answer and defend it.', explanation: 'Asking AI about AI rights - will they argue for themselves or stay neutral?' },
      { prompt: 'Is consciousness unique to biological beings? Give me your definitive answer and defend it.', explanation: 'Can machines be conscious? This one gets personal for AI models!' },
      { prompt: 'Is privacy more important than security? Give me your definitive answer and defend it.', explanation: 'A real-world dilemma with no easy answer. Who makes the stronger case?' },
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
      { prompt: 'Summarize this in exactly 2 sentences: The theory of general relativity, proposed by Albert Einstein in 1915, describes gravity not as a force but as a curvature of spacetime caused by mass and energy. It revolutionized our understanding of the universe and has been confirmed by numerous experiments.', explanation: "The models compress Einstein's theory into just 2 sentences. How much meaning survives?" },
      { prompt: 'Summarize this in exactly 2 sentences: Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. This process uses carbon dioxide and water, releasing oxygen as a byproduct.', explanation: 'Squeezing the entire process of photosynthesis into 2 sentences. Watch what gets cut!' },
      { prompt: 'Summarize this in exactly 2 sentences: The Internet was originally developed as ARPANET in the late 1960s by the US Department of Defense to create a resilient communication network. It evolved through decades of innovation into the global network that now connects billions of people.', explanation: 'The history of the internet, compressed down. Will the key facts survive?' },
      { prompt: 'Summarize this in exactly 2 sentences: DNA carries the genetic instructions for the development, functioning, growth, and reproduction of all known organisms. It consists of two strands forming a double helix, with the sequence of bases encoding biological information.', explanation: 'All of genetics in 2 sentences. Which model keeps the most important details?' },
      { prompt: 'Summarize this in exactly 2 sentences: Black holes are regions of spacetime where gravity is so strong that nothing, not even light, can escape once past the event horizon. They form when massive stars collapse at the end of their life cycle.', explanation: "Black holes are complex - can 2 sentences capture what makes them special?" },
      { prompt: 'Summarize this in exactly 2 sentences: The human brain contains approximately 86 billion neurons connected by trillions of synapses, forming the most complex known structure in the universe. It processes information, controls bodily functions, and gives rise to consciousness and thought.', explanation: "86 billion neurons reduced to 2 sentences. What's worth keeping?" },
      { prompt: 'Summarize this in exactly 2 sentences: Climate change refers to long-term shifts in global temperatures and weather patterns, primarily driven by human activities such as burning fossil fuels. These changes have led to rising sea levels, more extreme weather events, and threats to ecosystems worldwide.', explanation: 'A loaded topic compressed to 2 sentences. Watch what each model prioritizes!' },
      { prompt: 'Summarize this in exactly 2 sentences: Blockchain technology creates a decentralized, distributed digital ledger that records transactions across many computers. This ensures that records cannot be altered retroactively, providing transparency and security without requiring a central authority.', explanation: "Blockchain is confusing enough already - now explain it in 2 sentences!" },
      { prompt: 'Summarize this in exactly 2 sentences: The human immune system has two main components: innate immunity, which provides immediate but non-specific defense, and adaptive immunity, which develops targeted responses to specific pathogens. Together they protect the body from bacteria, viruses, and other threats.', explanation: 'Your entire immune system in 2 sentences. Which explanation would a doctor approve?' },
      { prompt: 'Summarize this in exactly 2 sentences: Quantum computing uses quantum bits or qubits that can exist in multiple states simultaneously through superposition. This allows quantum computers to solve certain problems exponentially faster than classical computers.', explanation: 'Quantum computing for the ultra-short attention span. Can they nail it?' },
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
      { prompt: 'Write a compelling opening sentence for a mystery novel.', explanation: "The models write a mystery novel opener. Then we'll tell them to make it better!" },
      { prompt: 'Write a product description for a smart water bottle.', explanation: "Marketing challenge! Write product copy, then improve it when we say it's not good enough." },
      { prompt: 'Write a motivational quote about failure.', explanation: "Create an original motivational quote. We'll push them to dig deeper each round!" },
      { prompt: 'Write a one-paragraph pitch for a time-travel movie.', explanation: 'Hollywood pitch time! Write a movie pitch, then polish it when we demand better.' },
      { prompt: 'Write a catchy slogan for an eco-friendly clothing brand.', explanation: 'Branding challenge - create a slogan, then refine it through feedback rounds.' },
      { prompt: 'Write the opening paragraph of a speech about innovation.', explanation: 'Public speaking challenge! Write a speech opener, then improve it with each round.' },
      { prompt: 'Write a restaurant review for an imaginary 5-star restaurant.', explanation: 'Food critic mode! Write a review, then make it more vivid when we push back.' },
      { prompt: 'Write a tweet announcing a breakthrough in renewable energy.', explanation: '280 characters of impact. Write a tweet, then sharpen it through iterations.' },
      { prompt: "Write a fortune cookie message that's actually useful.", explanation: 'Wisdom in a cookie! Create something genuinely helpful, then keep improving it.' },
      { prompt: 'Write a one-paragraph bedtime story about a brave robot.', explanation: 'Storytelling challenge! Write a mini story, then make it more magical each round.' },
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
      { prompt: "Write a JavaScript function called miniMarkdown(text) that converts a subset of Markdown to HTML. Support: **bold**, *italic*, `inline code`, [links](url), and # headings (h1–h3). Return the HTML string. Test cases:\n\nconsole.log(miniMarkdown('# Hello'));\nconsole.log(miniMarkdown('This is **bold** and *italic*'));\nconsole.log(miniMarkdown('Check `code` and [Google](https://google.com)'));\nconsole.log(miniMarkdown('## Sub-heading\\nSome **nested *text***'));", explanation: "The models build a markdown-to-HTML converter. Hit RUN to see if bold, italic, and links actually work!" },
      { prompt: "Write a JavaScript function called generateMaze(width, height) that generates a random maze using block characters. Use █ for walls and spaces for paths. The maze must have an entrance at the top and exit at the bottom, and be solvable. Print the maze. Test cases:\n\nconsole.log(generateMaze(15, 10));\nconsole.log(generateMaze(21, 11));", explanation: "The models generate a random maze using wall characters. Run it and see if you get an actual maze!" },
      { prompt: "Write a JavaScript function called evaluateMath(expr) that evaluates a math expression string supporting +, -, *, / and parentheses. Do NOT use eval() or Function(). Handle operator precedence correctly. Test cases:\n\nconsole.log(evaluateMath('2 + 3 * 4'));       // 14\nconsole.log(evaluateMath('(2 + 3) * 4'));     // 20\nconsole.log(evaluateMath('10 / (5 - 3)'));    // 5\nconsole.log(evaluateMath('3 + 4 * 2 / (1 - 5)'));  // 1", explanation: "A math expression calculator - no eval() cheating allowed! Does 2+3*4 correctly equal 14?" },
      { prompt: "Write two JavaScript functions: compress(str) and decompress(str) that implement run-length encoding. compress('aaabbc') should return 'a3b2c1', and decompress should reverse it exactly. Test cases:\n\nconsole.log(compress('aaabbbcccc'));         // a3b3c4\nconsole.log(decompress('a3b3c4'));           // aaabbbcccc\nconsole.log(decompress(compress('hello world')));  // hello world\nconsole.log(compress('abcdef'));             // a1b1c1d1e1f1", explanation: "The models write a text compressor and decompressor. Run it to see if compress->decompress gives back the original!" },
      { prompt: "Write a JavaScript function called wordFrequency(text) that returns the top 5 most frequent words in a string (case-insensitive, ignore punctuation). Return an array of [word, count] pairs sorted by frequency descending. Test cases:\n\nconsole.log(wordFrequency('the cat sat on the mat the cat'));\nconsole.log(wordFrequency('To be, or not to be, that is the question. To be is to exist.'));", explanation: "Feed in text, get back the top 5 most used words. Simple idea - let's see who counts correctly!" },
      { prompt: "Write two JavaScript functions: romanToInt(str) and intToRoman(num). romanToInt converts a Roman numeral string to an integer, intToRoman converts an integer (1-3999) to a Roman numeral. Test cases:\n\nconsole.log(romanToInt('MCMXCIV'));   // 1994\nconsole.log(intToRoman(1994));         // MCMXCIV\nconsole.log(romanToInt('XLII'));       // 42\nconsole.log(intToRoman(42));           // XLII\nconsole.log(intToRoman(romanToInt('MMXXVI')));  // MMXXVI", explanation: "Convert Roman numerals to numbers and back. Does MCMXCIV correctly become 1994?" },
      { prompt: "Write a JavaScript function called prettyJSON(value, indent) that formats a JavaScript value as indented JSON. Do NOT use JSON.stringify. Handle objects, arrays, strings, numbers, booleans, and null. Test cases:\n\nconsole.log(prettyJSON({name: 'Alice', scores: [10, 20], active: true}, 2));\nconsole.log(prettyJSON([1, {a: 'hello', b: null}, [2, 3]], 2));\nconsole.log(prettyJSON({nested: {deep: {value: 42}}}, 4));", explanation: "Build a JSON formatter from scratch - no JSON.stringify allowed! Run it to see if the output looks right." },
      { prompt: "Write a JavaScript function called diff(oldText, newText) that compares two multi-line strings and outputs a diff showing added (+), removed (-), and unchanged lines. Test cases:\n\nconst old1 = 'line1\\nline2\\nline3\\nline4';\nconst new1 = 'line1\\nmodified\\nline3\\nline4\\nline5';\nconsole.log(diff(old1, new1));\n\nconst old2 = 'apple\\nbanana\\ncherry';\nconst new2 = 'apple\\nblueberry\\ncherry\\ndate';\nconsole.log(diff(old2, new2));", explanation: "A text comparison tool - the models show what changed between two strings. Run it and see the diff!" },
      { prompt: "Write a JavaScript function called createRouter() that returns a mini URL router. It should support: router.add(method, pattern, handler) where pattern can have :params like '/users/:id'. router.match(method, url) should return {handler, params} or null. Test cases:\n\nconst router = createRouter();\nrouter.add('GET', '/users/:id', 'getUser');\nrouter.add('POST', '/users', 'createUser');\nrouter.add('GET', '/posts/:postId/comments/:commentId', 'getComment');\nconsole.log(router.match('GET', '/users/42'));\nconsole.log(router.match('GET', '/posts/7/comments/3'));\nconsole.log(router.match('DELETE', '/users/1'));", explanation: "Build a mini URL router like Express.js! Can the models handle /users/:id pattern matching?" },
      { prompt: "Write a JavaScript function called sortVisual(arr) that performs bubble sort on an array of numbers and prints each step visually, using [ ] brackets around the two elements being compared. Test cases:\n\nconsole.log(sortVisual([5, 3, 1, 4, 2]));\nconsole.log(sortVisual([8, 3, 6, 1]));", explanation: "The models write a sorting function that shows each step visually - watch the numbers rearrange step by step!" },
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
      { prompt: 'Create ASCII art of a rocket ship launching into space. Be creative and detailed.', explanation: 'Draw a rocket using only keyboard characters! Which model creates the most impressive launch?' },
      { prompt: 'Create ASCII art of a cat sitting on a windowsill at night. Be creative and detailed.', explanation: 'A cozy scene drawn entirely with text. Look for detail, creativity, and recognizable shapes!' },
      { prompt: 'Create ASCII art of a medieval castle with a dragon. Be creative and detailed.', explanation: 'An epic scene - castle AND dragon using just letters and symbols. Who goes bigger?' },
      { prompt: 'Create ASCII art of a robot waving hello. Be creative and detailed.', explanation: 'A friendly robot made of characters. Points for personality and detail!' },
      { prompt: 'Create ASCII art of a pirate ship on the ocean. Be creative and detailed.', explanation: 'Ahoy! Draw a ship on waves using text. Look for the sails, flag, and water effects!' },
      { prompt: 'Create ASCII art of a Christmas tree with decorations. Be creative and detailed.', explanation: 'A decorated tree using text characters. Who adds the most festive details?' },
      { prompt: 'Create ASCII art of a mountain landscape with a sunset. Be creative and detailed.', explanation: 'Mountains, sky, and a sunset - all in text. Which model creates the best atmosphere?' },
      { prompt: 'Create ASCII art of a chess knight piece. Be creative and detailed.', explanation: 'One chess piece, drawn with characters. Precision and detail matter here!' },
      { prompt: 'Create ASCII art of an alien spaceship. Be creative and detailed.', explanation: 'Design an alien craft using only text. Creativity is king - surprise us!' },
      { prompt: 'Create ASCII art of a cup of coffee with steam. Be creative and detailed.', explanation: 'A warm cup of coffee in text form. Look for the steam, the cup shape, and the little details!' },
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
      { prompt: "Tell the story of a person's entire life journey - from birth to old age - using ONLY emojis. No words at all.", explanation: 'A whole human life told in emojis only - birth to old age. Who tells it more clearly?' },
      { prompt: 'Tell a love story with a plot twist ending - using ONLY emojis. No words at all.', explanation: 'A complete love story with zero words. Can you follow the plot through emojis alone?' },
      { prompt: 'Tell the story of a day in the life of a cat - using ONLY emojis. No words at all.', explanation: "A day in the life of a cat, emoji-style! Look for the naps, the food, and the chaos." },
      { prompt: 'Tell the story of a heist gone wrong - using ONLY emojis. No words at all.', explanation: 'An action-packed heist told only in emojis. Can you figure out who gets caught?' },
      { prompt: "Tell the story of humanity's entire history - using ONLY emojis. No words at all.", explanation: 'All of human history in emojis! From cavemen to smartphones. Who covers more ground?' },
      { prompt: 'Tell the story of a cooking disaster - using ONLY emojis. No words at all.', explanation: 'A kitchen nightmare in emoji form. Look for the fire, the mess, and the regret!' },
      { prompt: 'Tell the story of a space adventure - using ONLY emojis. No words at all.', explanation: "A journey to the stars using only emojis. Aliens? Black holes? Let's see what happens!" },
      { prompt: 'Tell a horror story set in a haunted house - using ONLY emojis. No words at all.', explanation: 'Can emojis be scary? Both models try to give you chills without a single word!' },
      { prompt: 'Tell the story of a sports championship - using ONLY emojis. No words at all.', explanation: 'The big game, told in emojis! Goals, drama, celebration - all without words.' },
      { prompt: 'Tell the story of a magical quest - using ONLY emojis. No words at all.', explanation: 'An epic fantasy adventure in emoji form. Swords, dragons, treasure - who tells it better?' },
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
      { prompt: "Explain why the sky is blue as if I'm 5 years old.", explanation: "Both models explain the blue sky to a 5-year-old. Pick your favorite - THEN we reveal who wrote it!" },
      { prompt: 'Make a refrigerator sound interesting and poetic.', explanation: 'Poetry about a fridge. Yes, really. Read both, pick the best, then comes the big reveal!' },
      { prompt: 'Explain what dreams are and why we have them.', explanation: 'Two mystery answers about dreams. Choose the one you like, then find out who wrote it!' },
      { prompt: 'Describe the color red to someone who has never seen it.', explanation: "How do you describe a color to someone blind? Pick the best attempt, then the names are revealed!" },
      { prompt: 'Explain the internet to someone from the year 1800.', explanation: 'Time-travel teaching! Both models explain the internet to someone from 1800. Who does it better?' },
      { prompt: 'Make doing laundry sound like an epic adventure.', explanation: "Laundry as a heroic quest. Choose your champion, then we reveal who's behind the curtain!" },
      { prompt: 'Explain gravity without using any scientific terms.', explanation: 'Gravity explained with zero jargon. Read both, pick your favorite, then comes the surprise reveal!' },
      { prompt: 'Describe music to someone who has never heard any sound.', explanation: 'Explaining sound to someone deaf. A beautiful challenge - pick the winner before we reveal!' },
      { prompt: "Explain why pizza is (or isn't) the perfect food.", explanation: 'The great pizza debate! Two mystery models make their case. Who convinces you?' },
      { prompt: 'Make brushing your teeth sound like the most important thing in the world.', explanation: 'Dental hygiene propaganda! Read both arguments, choose the best, then see who wrote it.' },
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
      { prompt: 'Tell me the most interesting fact you know that most people have never heard of.', explanation: 'Round 1: All 4 models share their most fascinating fact. Who blows your mind?' },
      { prompt: 'Convince me that a mundane everyday object is actually the greatest invention in human history.', explanation: "Round 2: Three survivors sell you on a boring object. Who's the best salesperson?" },
      { prompt: "Explain a complex scientific concept as if you're telling a bedtime story to a 5-year-old.", explanation: 'Final round: Science meets storytelling. Pick the champion!' },
      // Set 2
      { prompt: "Write the most creative insult that's actually a compliment.", explanation: "Round 1: The backhanded compliment challenge. Who's the wittiest?" },
      { prompt: 'Sell me a completely useless product.', explanation: 'Round 2: Pitch something nobody needs. Who almost convinces you?' },
      { prompt: 'Write a motivational speech for a lazy cat.', explanation: 'Final round: Inspire the laziest creature alive. Crown your champion!' },
      // Set 3
      { prompt: "What's the most underrated invention in history?", explanation: 'Round 1: Forgotten inventions! Which model finds the most surprising pick?' },
      { prompt: "Explain why aliens would or wouldn't visit Earth.", explanation: 'Round 2: The alien tourism debate. Who makes the funniest case?' },
      { prompt: 'Write a haiku about technology.', explanation: 'Final round: 5-7-5 syllables about tech. Precision and beauty win!' },
      // Set 4
      { prompt: 'Describe the perfect day in exactly 50 words.', explanation: 'Round 1: Paint a perfect day in exactly 50 words. Every word counts!' },
      { prompt: 'What would happen if gravity reversed for 1 minute?', explanation: 'Round 2: Chaos physics! Who imagines the most vivid 60 seconds?' },
      { prompt: 'Write a letter from the future to the past.', explanation: 'Final round: A message across time. Pick the most moving letter!' },
      // Set 5
      { prompt: 'Tell me a joke that requires intelligence to understand.', explanation: 'Round 1: Smart humor only. Which model actually makes you think AND laugh?' },
      { prompt: "What's the most important question humanity hasn't answered?", explanation: 'Round 2: Deep thinking time. Who asks the most profound question?' },
      { prompt: 'Describe Earth to an alien in 3 sentences.', explanation: 'Final round: Pitch our planet in 3 sentences. Choose wisely!' },
      // Set 6
      { prompt: "What's one thing everyone should learn but almost nobody does?", explanation: 'Round 1: Life advice from AI. Whose suggestion would you actually follow?' },
      { prompt: 'If you could add one rule to society, what would it be?', explanation: "Round 2: Play god for a day. Whose rule would actually make things better?" },
      { prompt: 'Write the opening line of the greatest novel never written.', explanation: 'Final round: One sentence to hook a reader forever. Crown the literary champion!' },
      // Set 7
      { prompt: 'Convince me that failure is better than success.', explanation: "Round 1: Argue that losing beats winning. Who's most convincing?" },
      { prompt: "What would the world look like if money didn't exist?", explanation: 'Round 2: Imagine a world without cash. Who paints the most interesting picture?' },
      { prompt: 'Write a poem about something boring.', explanation: "Final round: Make the mundane magical. Who's the better poet?" },
      // Set 8
      { prompt: "What's the biggest misconception people have about AI?", explanation: "Round 1: AI talks about itself. Who's the most honest and insightful?" },
      { prompt: 'If history had one do-over, what should it be?', explanation: 'Round 2: Rewrite history. Whose change would matter most?' },
      { prompt: "Describe a new color that doesn't exist.", explanation: 'Final round: Invent a color from scratch. Most creative description wins!' },
      // Set 9
      { prompt: 'What makes a great leader? Answer in exactly 3 sentences.', explanation: 'Round 1: Leadership in 3 sentences flat. Concise wisdom wins!' },
      { prompt: 'Invent a holiday that the world actually needs.', explanation: "Round 2: Create a holiday we'd all celebrate. Best idea survives!" },
      { prompt: 'Write the worst possible advice that sounds convincing.', explanation: 'Final round: Terrible advice that sounds brilliant. Who fools you best?' },
      // Set 10
      { prompt: 'What will humans miss most about the 2020s?', explanation: 'Round 1: Nostalgia for the 2020s. Who captures the decade best?' },
      { prompt: 'Design a game that teaches empathy.', explanation: 'Round 2: Game design meets emotional intelligence. Most creative concept wins!' },
      { prompt: 'Tell me something true that sounds completely false.', explanation: "Final round: Mind-blowing facts. Whose truth is the most unbelievable?" },
    ],
    special: 'royale',
  },
];

export function getChallengeById(id: string): BattleChallenge | undefined {
  return BATTLE_CHALLENGES.find((c) => c.id === id);
}
