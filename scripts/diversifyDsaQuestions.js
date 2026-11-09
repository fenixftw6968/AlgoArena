const fs = require('fs');
const path = require('path');
const { dsaMasterQuestions } = require('../frontend/src/data/dsaMasterQuestions.js');

console.log('Original DSA questions:', dsaMasterQuestions.length);

// Replacement questions focused on code outputs, tree/graph traversals, invariant properties, recursion trace
const replacementQuestions = [
  {
    category: "Binary Trees",
    title: "Binary Tree Postorder Traversal",
    question: "Given a binary tree with root node value 1, left child 2, and right child 3, what is its Postorder traversal sequence?",
    options: [
      "2, 3, 1",
      "1, 2, 3",
      "2, 1, 3",
      "3, 2, 1"
    ],
    correctAnswer: "2, 3, 1",
    explanation: "Postorder traversal visits Left subtree, then Right subtree, and finally the Root node (Left -> Right -> Root). Hence: 2, 3, 1.",
    hint: "Postorder: Left, Right, Root."
  },
  {
    category: "Binary Search Trees",
    title: "BST Inorder Traversal Property",
    question: "What is guaranteed about the output sequence produced by an Inorder traversal of a valid Binary Search Tree (BST)?",
    options: [
      "The elements are output in strictly non-decreasing sorted order",
      "The root element always appears first in the sequence",
      "All leaf nodes are output before any internal nodes",
      "The sequence alternates between minimum and maximum keys"
    ],
    correctAnswer: "The elements are output in strictly non-decreasing sorted order",
    explanation: "Because BST invariant dictates left < root < right, an in-order traversal (Left, Root, Right) processes values in strictly sorted ascending order.",
    hint: "Left < Root < Right visits all keys in sorted order."
  },
  {
    category: "Linked Lists",
    title: "Floyd's Cycle Detection Pointers",
    question: "In Floyd's Cycle-Finding Algorithm (Tortoise and Hare), when slow moves 1 step and fast moves 2 steps, why are they guaranteed to meet if a cycle exists?",
    options: [
      "The distance between fast and slow decreases by exactly 1 node per iteration within the loop",
      "Fast moves infinitely faster than slow",
      "Slow reverses direction upon entering the loop",
      "The memory addresses wrap around modulo table size"
    ],
    correctAnswer: "The distance between fast and slow decreases by exactly 1 node per iteration within the loop",
    explanation: "Once both pointers are inside a cycle of length C, the relative distance between them changes by (2 - 1) = 1 step per step, ensuring the gap reduces to 0 (a meeting) in at most C steps.",
    hint: "Relative speed difference is 1, so the gap closes by 1 node on each step."
  },
  {
    category: "Graphs",
    title: "BFS Shortest Path Invariant",
    question: "Why does Breadth-First Search (BFS) guarantee finding the shortest path between two nodes in an unweighted graph?",
    options: [
      "It visits all vertices at distance d before exploring any vertex at distance d + 1",
      "It uses a priority queue ordered by heuristic edge weights",
      "It explores deepest nodes first using a call stack",
      "It sorts vertices topologically before searching"
    ],
    correctAnswer: "It visits all vertices at distance d before exploring any vertex at distance d + 1",
    explanation: "BFS explores vertex frontiers level by level in FIFO order. The first time a target vertex is reached, the path length is guaranteed to be minimal.",
    hint: "Explores all vertices at distance d before reaching any vertex at distance d + 1."
  },
  {
    category: "Dynamic Programming",
    title: "0/1 Knapsack Space Optimization",
    question: "When optimizing the 0/1 Knapsack DP table to a 1D array of capacity W, why must the inner loop iterate backwards from W down to weight[i]?",
    options: [
      "To prevent using the current item multiple times in the same transition step",
      "To sort the weights in descending order",
      "To avoid integer overflow when adding values",
      "Because negative weights are unsupported"
    ],
    correctAnswer: "To prevent using the current item multiple times in the same transition step",
    explanation: "Iterating forwards uses dp[w - weight] from the CURRENT item iteration (unbounded knapsack). Iterating backwards preserves the value from the PREVIOUS item iteration.",
    hint: "Going forwards would let the same item be reused multiple times."
  },
  {
    category: "Stacks & Queues",
    title: "Monotonic Stack Next Greater Element",
    question: "To find the Next Greater Element for every element in an array, what invariant should the stack maintain during traversal?",
    options: [
      "A monotonic decreasing order of values (or their indices)",
      "A strictly increasing order of values",
      "Elements sorted by their frequency of occurrence",
      "First element always equal to array maximum"
    ],
    correctAnswer: "A monotonic decreasing order of values (or their indices)",
    explanation: "A monotonic decreasing stack holds elements waiting for a greater element. When an element greater than stack.top() appears, it is the Next Greater Element for top().",
    hint: "Keep elements in decreasing order; when a bigger element appears, pop and record."
  },
  {
    category: "Code Output",
    title: "Recursion Stack Output Trace",
    question: "What does the following recursive function print for `fun(3)`?\n```cpp\nvoid fun(int n) {\n    if (n == 0) return;\n    fun(n - 1);\n    cout << n << \" \";\n}\n```",
    options: [
      "1 2 3",
      "3 2 1",
      "3 2 1 0",
      "1 2"
    ],
    correctAnswer: "1 2 3",
    explanation: "The recursive call occurs before printing. Calls stack up until fun(0) returns, then the print statements execute as unwinding occurs: 1, then 2, then 3.",
    hint: "The print happens during the unwinding phase of the recursion stack."
  },
  {
    category: "Heaps & Priority Queues",
    title: "Min-Heap Insertion Rebalance",
    question: "When a new element is inserted at the end of a Min-Heap array, which operation restores the heap invariant?",
    options: [
      "Percolate up (bubble up / sift up) with parent nodes",
      "Sift down with the smaller child",
      "Reverse the entire array",
      "Topological sort of the tree nodes"
    ],
    correctAnswer: "Percolate up (bubble up / sift up) with parent nodes",
    explanation: "The element is placed at index N (next leaf), then compared and swapped with its parent at `(i - 1) / 2` until the parent is smaller or it becomes root.",
    hint: "It bubbles up toward the root by swapping with smaller parents."
  },
  {
    category: "Hashing",
    title: "Quadratic Probing vs Linear Probing",
    question: "What primary issue with Linear Probing in hash tables is mitigated by Quadratic Probing?",
    options: [
      "Primary Clustering (formation of long continuous blocks of occupied slots)",
      "Hash collision rate dropping to zero",
      "Secondary index corruption",
      "Infinite loops during successful lookups"
    ],
    correctAnswer: "Primary Clustering (formation of long continuous blocks of occupied slots)",
    explanation: "Linear Probing causes adjacent occupied slots to merge into large contiguous clusters. Quadratic Probing uses an `i^2` step offset to disperse collisions across the table.",
    hint: "It breaks up continuous clusters of adjacent occupied slots."
  },
  {
    category: "Trees",
    title: "AVL Tree Rotation Trigger",
    question: "An AVL Tree node requires rebalancing when its balance factor (height(left) - height(right)) becomes:",
    options: [
      "Greater than +1 or less than -1",
      "Exactly equal to 0",
      "Equal to +1 only",
      "Greater than the depth of the root"
    ],
    correctAnswer: "Greater than +1 or less than -1",
    explanation: "AVL trees maintain the balance invariant: for every node, the difference in height between its left and right subtrees must be -1, 0, or +1. A factor of +2 or -2 triggers rotation.",
    hint: "The height difference must never exceed 1 in magnitude."
  },
  {
    category: "Graphs",
    title: "Topological Sort Existence Condition",
    question: "A graph admits a valid Topological Ordering if and only if it is a:",
    options: [
      "Directed Acyclic Graph (DAG)",
      "Connected Undirected Graph",
      "Complete Bipartite Graph",
      "Eulerian Tour Graph"
    ],
    correctAnswer: "Directed Acyclic Graph (DAG)",
    explanation: "A cycle creates a dependency deadlock where no vertex can be placed first. Hence, topological sorting requires directed edges and zero cycles (a DAG).",
    hint: "It must have directed edges and contain zero cycles."
  },
  {
    category: "Sorting",
    title: "QuickSort Pivot Worst-Case Invariant",
    question: "What condition causes standard Lomuto/Hoare QuickSort to degenerate into its worst-case O(n^2) performance when picking the first or last element as pivot?",
    options: [
      "The input array is already sorted or reverse sorted",
      "All elements are distinct and randomized",
      "The array length is an exact power of 2",
      "The pivot is always the exact median element"
    ],
    correctAnswer: "The input array is already sorted or reverse sorted",
    explanation: "When sorted data is partitioned using the first/last element, partitions are maximally unbalanced (1 element vs n - 1 elements), leading to n recursive levels.",
    hint: "Unbalanced splits occur on already sorted inputs when choosing edge elements."
  },
  {
    category: "Trie (Prefix Tree)",
    title: "Trie Node Structure",
    question: "In a standard 26-character English alphabet Trie, what does each node primarily store?",
    options: [
      "An array or map of 26 child node pointers and an `isEndOfWord` boolean flag",
      "The complete string formed from root to that node",
      "A hash of all previously inserted dictionary words",
      "A balanced AVL subtree containing words"
    ],
    correctAnswer: "An array or map of 26 child node pointers and an `isEndOfWord` boolean flag",
    explanation: "Each Trie node stores pointers to children corresponding to character edges (e.g. `children[26]`) and a boolean marker indicating if the path represents a completed word.",
    hint: "Pointers to children for each letter plus an end-of-word flag."
  },
  {
    category: "Disjoint Set Union (DSU)",
    title: "DSU Path Compression Effect",
    question: "What does the 'Path Compression' optimization do during the `find(x)` operation in a Disjoint Set Union (Union-Find) structure?",
    options: [
      "It points every visited node directly to the representative root of the set",
      "It combines two sets by comparing their sizes or ranks",
      "It sorts the elements in the disjoint set alphabetically",
      "It deletes disconnected graph components"
    ],
    correctAnswer: "It points every visited node directly to the representative root of the set",
    explanation: "Path compression flattens the tree structure by making every traversed node point directly to the root, reducing future `find` lookups to near O(1) amortized time.",
    hint: "It flattens tree height by linking traversed nodes straight to the root."
  },
  {
    category: "Linked Lists",
    title: "Reversing a Singly Linked List",
    question: "When reversing a singly linked list iteratively with three pointers (`prev = null`, `curr = head`, `next`), what is the correct pointer update order inside the loop?",
    options: [
      "next = curr->next; curr->next = prev; prev = curr; curr = next;",
      "curr->next = prev; next = curr->next; curr = next; prev = curr;",
      "prev = curr; curr = curr->next; next = prev;",
      "curr = curr->next; prev->next = curr; next = prev;"
    ],
    correctAnswer: "next = curr->next; curr->next = prev; prev = curr; curr = next;",
    explanation: "You must first save the remainder of the list (`next = curr->next`), then reverse the current link (`curr->next = prev`), advance `prev = curr`, and finally advance `curr = next`.",
    hint: "Save the forward pointer first so you don't lose the remaining list."
  },
  {
    category: "Binary Trees",
    title: "Binary Tree Diameter Definition",
    question: "The diameter (or width) of a binary tree is defined as:",
    options: [
      "The number of edges on the longest path between any two leaf nodes in the tree",
      "The total number of nodes located at the deepest level",
      "The maximum difference between leaf depths",
      "The height of the left subtree minus height of the right subtree"
    ],
    correctAnswer: "The number of edges on the longest path between any two leaf nodes in the tree",
    explanation: "Diameter is the length of the longest path between any two nodes in a tree, which may or may not pass through the root node.",
    hint: "The longest path connecting any pair of nodes in the tree."
  },
  {
    category: "Code Output",
    title: "Bitwise XOR In-Place Array Property",
    question: "Given an array where every integer appears twice except one single number that appears once, how does XOR fold the array to find the unique number?",
    options: [
      "XOR is commutative and associative, and X ^ X = 0 while X ^ 0 = X",
      "XOR adds all numbers modulo 2^32",
      "XOR multiplies odd numbers and subtracts even numbers",
      "XOR clears only the least significant bit of each number"
    ],
    correctAnswer: "XOR is commutative and associative, and X ^ X = 0 while X ^ 0 = X",
    explanation: "Identical pairs cancel out (`a ^ a = 0`). Because order does not matter, `(a ^ a) ^ (b ^ b) ^ ... ^ unique = 0 ^ unique = unique`.",
    hint: "Any number XORed with itself is 0, and XORed with 0 is itself."
  },
  {
    category: "Greedy Algorithms",
    title: "Activity Selection Problem Invariant",
    question: "In the greedy Activity Selection problem, which sorting criterion guarantees an optimal solution?",
    options: [
      "Sort activities in ascending order of their finish times",
      "Sort activities in ascending order of their start times",
      "Sort activities in descending order of their total duration",
      "Sort activities by earliest start time minus finish time"
    ],
    correctAnswer: "Sort activities in ascending order of their finish times",
    explanation: "Picking the activity that finishes earliest leaves the maximum remaining time available for subsequent compatible activities.",
    hint: "Finishing as early as possible frees up the resource for more future activities."
  },
  {
    category: "Strings",
    title: "KMP String Matching LPS Array",
    question: "In the Knuth-Morris-Pratt (KMP) pattern matching algorithm, what does the LPS array store for each index i?",
    options: [
      "Length of the longest proper prefix of pattern[0..i] that is also a suffix of pattern[0..i]",
      "The frequency count of characters up to index i",
      "The byte offset to the next vowel in the text",
      "The ASCII hash value of the pattern"
    ],
    correctAnswer: "Length of the longest proper prefix of pattern[0..i] that is also a suffix of pattern[0..i]",
    explanation: "LPS stands for 'Longest Prefix which is also Suffix'. It informs the matcher how many characters can be skipped upon mismatch without backtracking the text index.",
    hint: "Longest proper prefix that matches a suffix of the pattern."
  },
  {
    category: "Stacks & Queues",
    title: "Queue Implementation Using Stacks",
    question: "When implementing a FIFO Queue using two LIFO Stacks (stack1 for enqueue, stack2 for dequeue), when should elements be transferred from stack1 to stack2?",
    options: [
      "Only when stack2 is completely empty during a dequeue/peek operation",
      "After every single enqueue operation",
      "Whenever stack1 has more than 5 elements",
      "Periodically using a background timer thread"
    ],
    correctAnswer: "Only when stack2 is completely empty during a dequeue/peek operation",
    explanation: "Transferring elements only when stack2 is empty preserves FIFO order while amortizing the transfer cost to O(1) per operation over time.",
    hint: "Transfer all elements in reverse order only when the dequeue stack is empty."
  },
  {
    category: "Binary Trees",
    title: "Lowest Common Ancestor (LCA) in BST",
    question: "To find the Lowest Common Ancestor (LCA) of nodes p and q in a BST, how do we choose the branch from current node curr?",
    options: [
      "If both p and q are smaller than curr, go left; if both are larger, go right; otherwise curr is the LCA",
      "Always go to the subtree with greater height",
      "Perform a full BFS search for p, then a full DFS for q",
      "Choose the left branch whenever p is odd"
    ],
    correctAnswer: "If both p and q are smaller than curr, go left; if both are larger, go right; otherwise curr is the LCA",
    explanation: "In a BST, if p and q fall on opposite sides of curr (or one equals curr), curr is the first split point and therefore the Lowest Common Ancestor.",
    hint: "The first node where the paths to p and q split is their LCA."
  },
  {
    category: "Dynamic Programming",
    title: "Optimal Substructure Property",
    question: "A problem is said to have an 'Optimal Substructure' if:",
    options: [
      "An optimal solution to the problem contains optimal solutions to its subproblems",
      "The problem can be solved in strictly linear time",
      "The problem does not require any dynamic memory allocation",
      "All subproblems can be executed concurrently without shared state"
    ],
    correctAnswer: "An optimal solution to the problem contains optimal solutions to its subproblems",
    explanation: "Optimal substructure is a prerequisite for Greedy and DP: optimal global decisions are composed of optimal decisions for smaller sub-problems.",
    hint: "The optimal global answer can be constructed from optimal answers to subproblems."
  },
  {
    category: "Bit Manipulation",
    title: "Brian Kernighan's Bit Counting Trick",
    question: "What does the bitwise expression `n & (n - 1)` accomplish in a single operation?",
    options: [
      "It clears the lowest (rightmost) set bit (1-bit) of n",
      "It doubles the value of n",
      "It flips all bits of n",
      "It checks if n is divisible by 3"
    ],
    correctAnswer: "It clears the lowest (rightmost) set bit (1-bit) of n",
    explanation: "Subtracting 1 flips the rightmost set bit and all bits below it. ANDing with the original `n` zeros out that rightmost set bit, counting 1s in O(set bits) time.",
    hint: "It clears the lowest set bit in the binary representation."
  },
  {
    category: "Graphs",
    title: "Bipartite Graph 2-Coloring Invariant",
    question: "A graph is Bipartite (can be colored with 2 colors without adjacent matching colors) if and only if it contains:",
    options: [
      "No odd-length cycles",
      "No even-length cycles",
      "An even number of total edges",
      "Zero vertices with degree higher than 2"
    ],
    correctAnswer: "No odd-length cycles",
    explanation: "An odd-length cycle (like a triangle of 3 vertices) inevitably forces two adjacent vertices to share the same color. Graphs with only even cycles or trees are always bipartite.",
    hint: "Odd-length cycles make 2-coloring impossible."
  },
  {
    category: "Recursion & Backtracking",
    title: "N-Queens Safe Placement Check",
    question: "When placing a Queen at row `r` and column `c` on an N-Queens board, which diagonal indices can be used with hash sets for O(1) conflict checking?",
    options: [
      "`r - c` for main diagonals and `r + c` for anti-diagonals",
      "`r * c` for main diagonals and `r / c` for anti-diagonals",
      "`r ^ c` for all diagonals",
      "`r % c` for main diagonals and `c % r` for anti-diagonals"
    ],
    correctAnswer: "`r - c` for main diagonals and `r + c` for anti-diagonals",
    explanation: "On a chess board, elements on the same main diagonal share a constant `row - col`, and elements on the anti-diagonal share a constant `row + col`.",
    hint: "Row minus col is constant along one diagonal; row plus col along the other."
  }
];

// Identify time complexity questions in dsaMasterQuestions to replace
let repIdx = 0;
const updatedDsa = dsaMasterQuestions.map((q) => {
  const isTc = (/time complexity|complexity/i.test(q.question) || /complexity/i.test(q.title));
  if (isTc && repIdx < replacementQuestions.length) {
    const rep = replacementQuestions[repIdx++];
    return {
      ...q,
      category: rep.category,
      title: rep.title,
      question: rep.question,
      options: rep.options,
      correctAnswer: rep.correctAnswer,
      explanation: rep.explanation,
      hint: rep.hint
    };
  }
  return q;
});

console.log(`Replaced ${repIdx} repetitive time complexity questions with diverse practical questions!`);

// Save updated dsaMasterQuestions
const dsaPath = path.join(__dirname, '../frontend/src/data/dsaMasterQuestions.js');
const fileHeader = `/**\n * MindForge - dsaMasterQuestions\n * Exactly ${updatedDsa.length} Curated DSA Master Quiz Problems\n * Diversified algorithmic concepts, code outputs, data structure mechanics & problem-solving.\n */\n\n`;
const content = fileHeader + `export const dsaMasterQuestions = ` + JSON.stringify(updatedDsa, null, 2) + `;\n\nexport default dsaMasterQuestions;\n`;
fs.writeFileSync(dsaPath, content, 'utf8');
console.log('Successfully updated dsaMasterQuestions.js');

// Also update backend json for dsa-master-quiz
const backendDsaJsonPath = path.join(__dirname, '../backend/src/main/resources/questions/dsa-master-quiz.json');
fs.writeFileSync(backendDsaJsonPath, JSON.stringify(updatedDsa, null, 2), 'utf8');
console.log('Successfully updated backend dsa-master-quiz.json');

