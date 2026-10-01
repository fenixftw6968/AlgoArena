const fs = require('fs');
const path = require('path');
const { dsaMasterQuestions } = require('../frontend/src/data/dsaMasterQuestions.js');

// 1. Gather current unique questions
const uniqueEasy = [];
const uniqueMed = [];
const uniqueHard = [];
const seenTexts = new Set();

for (const q of dsaMasterQuestions) {
  const txt = q.question.trim().toLowerCase();
  if (seenTexts.has(txt)) continue;
  seenTexts.add(txt);

  const diff = (q.difficulty || 'MEDIUM').toUpperCase();
  if (diff === 'EASY') uniqueEasy.push(q);
  else if (diff === 'HARD') uniqueHard.push(q);
  else uniqueMed.push(q);
}

console.log(`Current unique DSA: EASY=${uniqueEasy.length}, MED=${uniqueMed.length}, HARD=${uniqueHard.length}`);

// 9 New high quality EASY questions to reach exactly 50
const newEasy = [
  {
    title: 'Stack Overflow Cause',
    category: 'Stacks',
    question: 'What primary condition causes a stack overflow error during program execution?',
    options: [
      'Excessive or unbounded recursion exceeding call stack limits',
      'Declaring a dynamic heap array with new',
      'Reading from an empty queue',
      'Passing variables by const reference'
    ],
    correctAnswer: 'Excessive or unbounded recursion exceeding call stack limits',
    explanation: 'Each function call allocates an activation record on the call stack. Deep or infinite recursion exhausts available stack memory, triggering a stack overflow.',
    hint: 'Think about what memory is consumed when functions call themselves repeatedly.'
  },
  {
    title: 'Circular Queue Dequeue',
    category: 'Queues',
    question: 'In a FIFO queue implemented with a circular array buffer, what is the time complexity of the dequeue operation?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
    correctAnswer: 'O(1)',
    explanation: 'A circular buffer advances the front pointer with modulo arithmetic in O(1) constant time without shifting remaining elements.',
    hint: 'Circular buffers update index pointers directly.'
  },
  {
    title: 'Linear Search Worst Case',
    category: 'Searching',
    question: 'What is the worst-case time complexity of linear search on an unsorted array of size n?',
    options: ['O(n)', 'O(1)', 'O(log n)', 'O(n log n)'],
    correctAnswer: 'O(n)',
    explanation: 'If the target element is at the very last index or absent, linear search must inspect all n elements sequentially, requiring O(n) comparisons.',
    hint: 'In the worst case, every element must be inspected.'
  },
  {
    title: 'Binary Tree Degree',
    category: 'Trees',
    question: 'What is the maximum number of children any single node can have in a binary tree?',
    options: ['2', '1', '3', 'Unlimited'],
    correctAnswer: '2',
    explanation: 'By definition, every node in a binary tree has at most two children: left child and right child.',
    hint: 'The prefix "bi-" indicates two.'
  },
  {
    title: 'String Index Access',
    category: 'Strings',
    question: 'In C++, what is the time complexity to access the character at index i using operator[] on a std::string?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(i)'],
    correctAnswer: 'O(1)',
    explanation: 'std::string stores its characters in contiguous memory, allowing direct address calculation in O(1) constant time.',
    hint: 'Contiguous character storage allows direct indexing.'
  },
  {
    title: 'Selection Sort Invariant',
    category: 'Sorting',
    question: 'In Selection Sort after k iterations of the outer loop, what property is guaranteed?',
    options: [
      'The first k elements are in their final sorted positions',
      'The array is completely partitioned around a pivot',
      'All elements are within k positions of their final spot',
      'The last k elements are in reverse order'
    ],
    correctAnswer: 'The first k elements are in their final sorted positions',
    explanation: 'Selection sort finds the minimum of the unsorted suffix in each step and swaps it into index k - 1, placing it in its final sorted position.',
    hint: 'Each pass permanently places the next minimum item.'
  },
  {
    title: 'Singly Linked List Delete Head',
    category: 'Linked Lists',
    question: 'What is the time complexity of deleting the head node of a singly linked list given the head pointer?',
    options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
    correctAnswer: 'O(1)',
    explanation: 'Deleting the head only requires advancing the head pointer to head->next and freeing the old node, taking O(1) time.',
    hint: 'No list traversal is needed to remove the first node.'
  },
  {
    title: 'Complete Binary Tree Leaves',
    category: 'Trees',
    question: 'In a complete binary tree of n nodes stored in a 0-indexed array, at which index do leaf nodes begin?',
    options: ['floor(n / 2)', 'floor(n / 4)', 'floor(n / 3)', 'n - 1'],
    correctAnswer: 'floor(n / 2)',
    explanation: 'In a 0-indexed array, internal nodes occupy indices 0 to floor(n/2) - 1. Leaf nodes occupy indices from floor(n/2) to n - 1.',
    hint: 'Nodes after half the array have child indices exceeding n.'
  },
  {
    title: 'Hash Map Key Collision Overwrite',
    category: 'Hash Tables',
    question: 'What happens when inserting an existing key with a new value using map[key] = val in C++ std::unordered_map?',
    options: [
      'The existing value associated with that key is updated',
      'A compilation error occurs',
      'A second entry with duplicate key is created',
      'An exception is thrown at runtime'
    ],
    correctAnswer: 'The existing value associated with that key is updated',
    explanation: 'Keys in std::unordered_map must be unique. Using operator[] overwrites the value mapped to the existing key.',
    hint: 'Map keys are unique identifiers.'
  }
];

// 27 New high quality HARD questions to reach exactly 50
const newHard = [
  {
    title: 'Segment Tree Point Update',
    category: 'Advanced Trees',
    question: 'What is the time complexity of a point update in a standard Segment Tree containing n elements?',
    options: ['O(log n)', 'O(1)', 'O(n)', 'O(sqrt(n))'],
    correctAnswer: 'O(log n)',
    explanation: 'A point update modifies one leaf and recalculates values along the path up to the root, which has height O(log n).',
    hint: 'The height of a segment tree for n elements is logarithmic.'
  },
  {
    title: 'Fenwick Tree Space Complexity',
    category: 'Advanced Trees',
    question: 'What is the auxiliary space complexity of a Binary Indexed Tree (Fenwick Tree) constructed for an array of size n?',
    options: ['O(n)', 'O(n log n)', 'O(1)', 'O(n^2)'],
    correctAnswer: 'O(n)',
    explanation: 'A Fenwick Tree stores partial prefix sums in a single 1D array of size n + 1, requiring strictly O(n) space.',
    hint: 'A Fenwick tree requires a single array matching the input size.'
  },
  {
    title: 'Lazy Propagation Range Update',
    category: 'Advanced Trees',
    question: 'What is the time complexity of updating an entire range [L, R] in a Segment Tree using Lazy Propagation?',
    options: ['O(log n)', 'O(R - L)', 'O(n)', 'O(1)'],
    correctAnswer: 'O(log n)',
    explanation: 'Lazy propagation postpones updates to descendants, allowing range updates to terminate as soon as a canonical node segment matches in O(log n) steps.',
    hint: 'Postponing updates to children keeps segment traversal logarithmic.'
  },
  {
    title: 'Hopcroft-Karp Matching Complexity',
    category: 'Graphs',
    question: 'What is the worst-case time complexity of the Hopcroft-Karp algorithm for maximum bipartite matching in graph G = (V, E)?',
    options: ['O(E * sqrt(V))', 'O(V * E)', 'O(V^2 * E)', 'O(E log V)'],
    correctAnswer: 'O(E * sqrt(V))',
    explanation: 'Hopcroft-Karp finds a maximal set of shortest augmenting paths in each phase using BFS and DFS, finishing in O(sqrt(V)) phases for O(E * sqrt(V)) total time.',
    hint: 'The algorithm terminates in at most O(sqrt(V)) phases.'
  },
  {
    title: 'Tarjan Bridge Finding Condition',
    category: 'Graphs',
    question: 'In Tarjan DFS bridge-finding algorithm with discovery time disc[u] and low-link low[v], when is edge (u, v) a bridge?',
    options: ['low[v] > disc[u]', 'low[v] == disc[u]', 'low[v] < disc[u]', 'low[v] >= disc[u]'],
    correctAnswer: 'low[v] > disc[u]',
    explanation: 'If low[v] > disc[u], no vertex in subtree rooted at v can reach u or its ancestors via a back-edge, making (u, v) a bridge.',
    hint: 'Subtree v cannot reach u or above through any back-edge.'
  },
  {
    title: 'Johnson Algorithm Reweighting',
    category: 'Graphs',
    question: 'What technique does Johnsons algorithm use to eliminate negative edge weights before running Dijkstras from every vertex?',
    options: [
      'Reweighting with Bellman-Ford vertex potentials',
      'Adding the absolute value of the minimum edge weight to all edges',
      'Squaring all negative weights',
      'Removing cycles with Floyd-Warshall'
    ],
    correctAnswer: 'Reweighting with Bellman-Ford vertex potentials',
    explanation: 'Johnsons algorithm runs Bellman-Ford on an auxiliary source to compute potential h(u). Reweighted weight w\'(u, v) = w(u, v) + h(u) - h(v) >= 0 preserves shortest paths.',
    hint: 'A single Bellman-Ford pass computes potential values for every node.'
  },
  {
    title: 'Suffix Automaton Size',
    category: 'Strings',
    question: 'For a string of length n, what is the maximum number of states in its Suffix Automaton (DAWG)?',
    options: ['2n - 1', 'n^2', '2^n', 'n log n'],
    correctAnswer: '2n - 1',
    explanation: 'A Suffix Automaton is remarkably compact: for any string of length n >= 2, the number of states does not exceed 2n - 1.',
    hint: 'The number of states is strictly linear in string length.'
  },
  {
    title: 'A* Search Admissibility',
    category: 'Heuristic Search',
    question: 'In the A* search algorithm, what condition must the heuristic function h(n) satisfy to be admissible?',
    options: [
      'h(n) must never overestimate the true minimum cost to reach the goal',
      'h(n) must always equal the exact cost',
      'h(n) must be strictly greater than the true cost',
      'h(n) must be monotonic only without bounds'
    ],
    correctAnswer: 'h(n) must never overestimate the true minimum cost to reach the goal',
    explanation: 'An admissible heuristic never overestimates the true remaining cost, guaranteeing that A* tree search finds the optimal shortest path.',
    hint: 'The heuristic must be optimistic, never overestimating.'
  },
  {
    title: 'Travelling Salesperson DP Complexity',
    category: 'Dynamic Programming',
    question: 'What is the time complexity of solving the Travelling Salesperson Problem using the Held-Karp bitmask DP algorithm?',
    options: ['O(n^2 * 2^n)', 'O(n!)', 'O(2^n)', 'O(n^3 * 2^n)'],
    correctAnswer: 'O(n^2 * 2^n)',
    explanation: 'There are 2^n subsets and n possible ending cities, giving n * 2^n states. Transitioning to the next city takes O(n), yielding O(n^2 * 2^n) time.',
    hint: 'States are defined by (visited_mask, last_visited_city).'
  },
  {
    title: 'Heavy-Light Decomposition Query',
    category: 'Advanced Trees',
    question: 'What is the time complexity to query path aggregates between two nodes in a tree of size n using Heavy-Light Decomposition with a Segment Tree?',
    options: ['O(log^2 n)', 'O(log n)', 'O(sqrt(n))', 'O(n log n)'],
    correctAnswer: 'O(log^2 n)',
    explanation: 'Any path between two nodes crosses at most O(log n) heavy chains. Querying each chain via Segment Tree takes O(log n), for O(log^2 n) total.',
    hint: 'Light edges are crossed at most O(log n) times.'
  },
  {
    title: 'Edmonds-Karp Max Flow Complexity',
    category: 'Network Flow',
    question: 'What is the worst-case time complexity of the Edmonds-Karp algorithm for computing maximum network flow?',
    options: ['O(V * E^2)', 'O(V^2 * E)', 'O(E log V)', 'O(V^3)'],
    correctAnswer: 'O(V * E^2)',
    explanation: 'Edmonds-Karp finds augmenting paths using BFS. Each augmenting path takes O(E), and there are at most O(V * E) total augmentations, yielding O(V * E^2).',
    hint: 'BFS path finding takes O(E) with at most O(V * E) augmentations.'
  },
  {
    title: 'Dinic Algorithm Complexity',
    category: 'Network Flow',
    question: 'What is the worst-case time complexity of Dinics algorithm for maximum flow on a general network?',
    options: ['O(V^2 * E)', 'O(V * E^2)', 'O(V^3)', 'O(E * sqrt(V))'],
    correctAnswer: 'O(V^2 * E)',
    explanation: 'Dinics algorithm uses level graphs constructed via BFS and blocking flows via DFS, running in O(V^2 * E) on general networks.',
    hint: 'Constructs level graphs with at most V phases.'
  },
  {
    title: 'Convex Hull Graham Scan',
    category: 'Computational Geometry',
    question: 'What is the time complexity of finding the 2D convex hull of n points using the Graham Scan algorithm?',
    options: ['O(n log n)', 'O(n^2)', 'O(n)', 'O(n sqrt(n))'],
    correctAnswer: 'O(n log n)',
    explanation: 'Sorting the points radially by polar angle takes O(n log n). The subsequent stack-based hull scan runs in linear O(n) time, yielding O(n log n) overall.',
    hint: 'Dominated by the angular sort of points.'
  },
  {
    title: 'Red-Black Tree Max Height',
    category: 'Balanced BST',
    question: 'What is the maximum theoretical height of a Red-Black tree containing n internal nodes?',
    options: ['2 * log2(n + 1)', 'log2(n)', '3 * log2(n)', 'sqrt(n)'],
    correctAnswer: '2 * log2(n + 1)',
    explanation: 'Because red nodes cannot be adjacent and all root-to-null paths have equal black height, the longest path is at most twice the shortest path: 2 * log2(n + 1).',
    hint: 'No two red nodes can appear consecutively on any path.'
  },
  {
    title: 'Splay Tree Amortized Complexity',
    category: 'Balanced BST',
    question: 'What is the amortized time complexity of basic operations (Search, Insert, Delete) in a Splay Tree?',
    options: ['O(log n)', 'O(1)', 'O(n)', 'O(log^2 n)'],
    correctAnswer: 'O(log n)',
    explanation: 'By using zig-zig and zig-zag splay rotations, frequently accessed nodes migrate near root, guaranteeing amortized O(log n) time per operation via potential analysis.',
    hint: 'Individual operations can take O(n), but amortized over m operations is logarithmic.'
  },
  {
    title: 'Matrix Exponentiation Fibonacci',
    category: 'Dynamic Programming',
    question: 'What is the time complexity to compute the n-th Fibonacci number modulo 10^9+7 using 2x2 matrix exponentiation?',
    options: ['O(log n)', 'O(n)', 'O(1)', 'O(sqrt(n))'],
    correctAnswer: 'O(log n)',
    explanation: 'Binary exponentiation of the 2x2 companion matrix [[1, 1], [1, 0]]^n computes the result in O(2^3 * log n) = O(log n) operations.',
    hint: 'Binary exponentiation squares the matrix at each step.'
  },
  {
    title: 'Knuth DP Optimization',
    category: 'Dynamic Programming',
    question: 'When can Knuths DP optimization be applied to reduce recurrence transitions from O(n^3) to O(n^2)?',
    options: [
      'When the cost function satisfies quadrangle inequality and optimal split points are monotonic',
      'When state values are strictly powers of two',
      'When the transition matrix is symmetric',
      'When all weights are non-negative'
    ],
    correctAnswer: 'When the cost function satisfies quadrangle inequality and optimal split points are monotonic',
    explanation: 'Knuth optimization requires cost C satisfying the quadrangle inequality C(a, c) + C(b, d) <= C(a, d) + C(b, c), restricting optimal split opt[i][j-1] <= opt[i][j] <= opt[i+1][j].',
    hint: 'Involves quadrangle inequality and monotonic split bounds.'
  },
  {
    title: 'Suffix Array Kasai Algorithm',
    category: 'Strings',
    question: 'What is the time complexity of Kasais algorithm for building the Longest Common Prefix (LCP) array from a sorted Suffix Array?',
    options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(n sqrt(n))'],
    correctAnswer: 'O(n)',
    explanation: 'Kasais algorithm processes suffixes in order of decreasing length. The LCP value drops by at most 1 in consecutive steps, allowing linear O(n) construction.',
    hint: 'The LCP value decreases by at most 1 between suffix[i] and suffix[i+1].'
  },
  {
    title: 'Mo Algorithm Optimal Block Size',
    category: 'Advanced Algorithms',
    question: 'For an array of size n and q offline range queries, what is the optimal block size in Mos Algorithm to achieve O((n + q) * sqrt(n)) time?',
    options: ['O(sqrt(n))', 'O(log n)', 'O(n / 2)', 'O(n^(2/3))'],
    correctAnswer: 'O(sqrt(n))',
    explanation: 'Partitioning indices into blocks of size B = ceil(n / sqrt(q)) or O(sqrt(n)) balances left and right pointer movements, achieving optimal O((n + q) * sqrt(n)) total runtime.',
    hint: 'Balances the left pointer within-block jumps and right pointer monotonic sweeps.'
  },
  {
    title: 'Centroid Decomposition Depth',
    category: 'Advanced Trees',
    question: 'What is the maximum recursion depth when performing Centroid Decomposition on an arbitrary tree with n nodes?',
    options: ['O(log n)', 'O(n)', 'O(sqrt(n))', 'O(log^2 n)'],
    correctAnswer: 'O(log n)',
    explanation: 'Removing a tree centroid partitions remaining subtrees into components each of size at most n / 2. This guarantees maximum recursion depth O(log2 n).',
    hint: 'Subtree sizes shrink by at least half at every level.'
  },
  {
    title: 'Articulation Point Root Condition',
    category: 'Graphs',
    question: 'In DFS tree-based biconnected component analysis, when is the root of the DFS tree considered an articulation point (cut vertex)?',
    options: [
      'When it has two or more DFS tree children',
      'When its discovery time is 1',
      'When all its edges are back-edges',
      'When it is connected to a leaf'
    ],
    correctAnswer: 'When it has two or more DFS tree children',
    explanation: 'A DFS root has no ancestors. If it has >= 2 children in the DFS tree, removing it disconnects those two child subtrees because no back-edges can bridge between them.',
    hint: 'The root must separate at least two independent child branches.'
  },
  {
    title: 'Treap Invariants',
    category: 'Balanced BST',
    question: 'Which two invariants must hold simultaneously at every node in a Treap data structure?',
    options: [
      'BST order on search keys and Heap order on random priorities',
      'AVL height balance and Red-Black color balance',
      'Min-heap order on both keys and priorities',
      'Queue FIFO order on keys and LIFO on priorities'
    ],
    correctAnswer: 'BST order on search keys and Heap order on random priorities',
    explanation: 'A Treap is a hybrid Binary Search Tree + Heap. Search keys maintain standard BST in-order sorting, while randomly assigned priorities maintain Heap property via rotations.',
    hint: 'Tree + Heap = Treap.'
  },
  {
    title: 'Z-Algorithm Time Complexity',
    category: 'Strings',
    question: 'What is the worst-case time complexity of the Z-algorithm to compute the Z-array for a string of length n?',
    options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(n + Sigma)'],
    correctAnswer: 'O(n)',
    explanation: 'The Z-algorithm maintains the rightmost matching interval [L, R], advancing R monotonically. Character comparisons either succeed (advancing R) or fail once, running in strictly linear O(n) time.',
    hint: 'Uses rightmost interval bounds to avoid redundant comparisons.'
  },
  {
    title: 'Link-Cut Tree Amortized Cost',
    category: 'Advanced Trees',
    question: 'What is the amortized time complexity of dynamic tree operations (link, cut, path aggregate) in a Link-Cut Tree?',
    options: ['O(log n)', 'O(1)', 'O(log^2 n)', 'O(sqrt(n))'],
    correctAnswer: 'O(log n)',
    explanation: 'Link-Cut Trees represent rooted forests using splay trees over preferred paths, providing amortized O(log n) time per operation via potential functions.',
    hint: 'Preferred paths are represented as splay trees.'
  },
  {
    title: 'Sparse Table RMQ Complexity',
    category: 'Range Queries',
    question: 'What is the query time complexity for Range Minimum Query (RMQ) using a preprocessed Sparse Table?',
    options: ['O(1)', 'O(log n)', 'O(sqrt(n))', 'O(n)'],
    correctAnswer: 'O(1)',
    explanation: 'Because min(A, B) is idempotent (min(x, x) = x), any interval [L, R] can be covered by two overlapping power-of-two intervals, answering in O(1) time.',
    hint: 'Idempotency allows overlapping intervals to answer in constant time.'
  },
  {
    title: 'Manacher Transformation',
    category: 'Strings',
    question: 'In Manachers algorithm, what transformation is applied to input string s of length n to handle odd and even palindromes uniformly?',
    options: [
      'Insert a sentinel delimiter character (e.g. #) between every character and at ends',
      'Double every character in the string',
      'Reverse the string and concatenate with delimiter',
      'Pad the string with null terminators until power of 2'
    ],
    correctAnswer: 'Insert a sentinel delimiter character (e.g. #) between every character and at ends',
    explanation: 'Transforming "aba" into "#a#b#a#" maps all palindromes to odd-length palindromes centered at characters or delimiters, allowing a single uniform expansion loop.',
    hint: 'Interleaving delimiters ensures all palindromes have an odd length.'
  },
  {
    title: 'Kosaraju Algorithm DFS Passes',
    category: 'Graphs',
    question: 'How many total DFS passes are performed in Kosarajus algorithm to find all strongly connected components (SCCs) in a directed graph?',
    options: [
      'Two DFS passes (first on original graph, second on transposed graph)',
      'Single DFS pass with low-link values',
      'Three passes (BFS, DFS, topological sort)',
      'V passes, one from each vertex'
    ],
    correctAnswer: 'Two DFS passes (first on original graph, second on transposed graph)',
    explanation: 'Pass 1 orders vertices by finishing time on G. Pass 2 visits vertices in reverse finishing order on transposed graph G^T, identifying each SCC.',
    hint: 'Pass on original graph followed by pass on reversed graph.'
  }
];

// Combine exactly 50 EASY, 50 MEDIUM, 50 HARD
const finalEasy = [...uniqueEasy.slice(0, 41), ...newEasy];
const finalMed = uniqueMed.slice(0, 50);
const finalHard = [...uniqueHard.slice(0, 23), ...newHard];

console.log(`Final counts: EASY=${finalEasy.length}, MED=${finalMed.length}, HARD=${finalHard.length}`);

if (finalEasy.length !== 50 || finalMed.length !== 50 || finalHard.length !== 50) {
  throw new Error('Counts must be exactly 50 each!');
}

const allQuestions = [];
let idCounter = 1;

function processGroup(group, diff) {
  group.forEach(q => {
    // Validate options
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question "${q.title}" must have 4 options`);
    }
    if (!q.options.includes(q.correctAnswer)) {
      throw new Error(`Correct answer "${q.correctAnswer}" not in options for "${q.title}"`);
    }
    // Check no duplicate options
    const optSet = new Set(q.options);
    if (optSet.size !== 4) {
      throw new Error(`Duplicate options in "${q.title}"`);
    }

    allQuestions.push({
      id: `dsa-${idCounter++}`,
      gameType: 'dsa-master-quiz',
      difficulty: diff,
      category: q.category || 'General DSA',
      title: q.title || `DSA Problem ${idCounter}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'Detailed step-by-step algorithmic analysis.',
      hint: q.hint || 'Carefully review time/space constraints.'
    });
  });
}

processGroup(finalEasy, 'EASY');
processGroup(finalMed, 'MEDIUM');
processGroup(finalHard, 'HARD');

console.log(`Total questions generated: ${allQuestions.length}`);

// Verify total uniqueness of question texts
const finalCheck = new Set();
allQuestions.forEach(q => {
  const txt = q.question.trim().toLowerCase();
  if (finalCheck.has(txt)) {
    throw new Error(`Duplicate question text found: ${txt}`);
  }
  finalCheck.add(txt);
});
console.log('ALL 150 QUESTIONS ARE 100% UNIQUE!');

// Write to frontend/src/data/dsaMasterQuestions.js
const fileContent = `/**
 * MindForge - dsaMasterQuestions
 * Exactly 150 Curated DSA Master Quiz Problems
 * (50 Novice / EASY, 50 Intermediate / MEDIUM, 50 Expert / HARD)
 * 100% Unique Questions, Balanced Options, Verified Explanations
 */

export const dsaMasterQuestions = ${JSON.stringify(allQuestions, null, 2)};

export default dsaMasterQuestions;
`;

fs.writeFileSync(path.join(__dirname, '../frontend/src/data/dsaMasterQuestions.js'), fileContent, 'utf8');
console.log('Successfully wrote frontend/src/data/dsaMasterQuestions.js');
