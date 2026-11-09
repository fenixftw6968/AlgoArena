const fs = require('fs');
const path = require('path');

const osQuestions = [
  {
    id: "os-1",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Processes & Threads",
    title: "Process vs Thread Memory Sharing",
    question: "Which of the following resources is shared among multiple threads belonging to the same process?",
    options: [
      "Address space and global variables",
      "Thread execution stack",
      "CPU register contents",
      "Program counter"
    ],
    correctAnswer: "Address space and global variables",
    explanation: "Threads of the same process share code, data sections, and heap memory (address space), but each thread maintains its own stack, register set, and program counter.",
    hint: "Think about which component must be unique to track independent function calls."
  },
  {
    id: "os-2",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "CPU Scheduling",
    title: "Preemptive CPU Scheduling",
    question: "Which CPU scheduling algorithm selects the process with the smallest remaining burst time?",
    options: [
      "Shortest Remaining Time First (SRTF)",
      "First Come First Served (FCFS)",
      "Non-preemptive Priority Scheduling",
      "Round Robin (RR)"
    ],
    correctAnswer: "Shortest Remaining Time First (SRTF)",
    explanation: "SRTF is the preemptive version of SJF (Shortest Job First), always preempting the CPU if a newly arrived process has a shorter remaining burst time.",
    hint: "It is the preemptive variant of Shortest Job First."
  },
  {
    id: "os-3",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Deadlocks",
    title: "Coffman Conditions for Deadlock",
    question: "Which condition is NOT one of the four necessary Coffman conditions required for a deadlock to occur?",
    options: [
      "Preemptive resource allocation",
      "Mutual exclusion",
      "Hold and wait",
      "Circular wait"
    ],
    correctAnswer: "Preemptive resource allocation",
    explanation: "The four Coffman conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. If preemption is allowed, deadlock cannot occur.",
    hint: "Deadlocks require that resources cannot be forcefully taken away."
  },
  {
    id: "os-4",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Memory Management",
    title: "Belady's Anomaly",
    question: "Belady's Anomaly occurs in which page replacement algorithm where increasing frame count increases page faults?",
    options: [
      "FIFO (First-In, First-Out)",
      "LRU (Least Recently Used)",
      "Optimal Page Replacement",
      "LFU (Least Frequently Used)"
    ],
    correctAnswer: "FIFO (First-In, First-Out)",
    explanation: "FIFO page replacement can exhibit Belady's Anomaly, where allocating more physical memory frames paradoxically results in more page faults.",
    hint: "Stack-based algorithms like LRU are immune to this anomaly."
  },
  {
    id: "os-5",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Process Synchronization",
    title: "Counting Semaphore",
    question: "What does the integer value of a counting semaphore represent?",
    options: [
      "Number of available units of a shared resource",
      "Number of processes blocked in the ready queue",
      "Process priority level in the kernel scheduler",
      "Number of CPU cores currently online"
    ],
    correctAnswer: "Number of available units of a shared resource",
    explanation: "A counting semaphore initialized to N allows up to N concurrent threads/processes to acquire the resource before blocking subsequent callers.",
    hint: "When it reaches zero, subsequent wait() calls block."
  },
  {
    id: "os-6",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Process Lifecycle",
    title: "Zombie Process State",
    question: "A process that has finished execution but still has an entry in the process table is known as a:",
    options: [
      "Zombie process",
      "Orphan process",
      "Daemon process",
      "Sleeping process"
    ],
    correctAnswer: "Zombie process",
    explanation: "A zombie process has completed execution via exit(), but its entry remains in the process table until its parent reads its exit status via wait().",
    hint: "Its parent has not yet called wait() to reap it."
  },
  {
    id: "os-7",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "System Calls",
    title: "fork() System Call Return Value",
    question: "In Unix-like systems, what does a successful fork() system call return to the parent process?",
    options: [
      "PID of the newly created child process",
      "0",
      "-1",
      "PID of the parent process itself"
    ],
    correctAnswer: "PID of the newly created child process",
    explanation: "fork() returns 0 to the child process, and returns the positive PID of the new child to the parent process (or -1 on failure).",
    hint: "The parent needs to know which child was created."
  },
  {
    id: "os-8",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Deadlocks",
    title: "Banker's Algorithm Purpose",
    question: "Banker's Algorithm is primarily used in operating systems for:",
    options: [
      "Deadlock avoidance by checking for safe states",
      "Deadlock detection and automatic recovery",
      "CPU process scheduling priority calculation",
      "Disk I/O block defragmentation"
    ],
    correctAnswer: "Deadlock avoidance by checking for safe states",
    explanation: "Banker's Algorithm avoids deadlocks by simulating the allocation of maximum predetermined resources and verifying if system remains in a safe state.",
    hint: "It ensures the system never enters an unsafe state before granting a resource."
  },
  {
    id: "os-9",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Memory Management",
    title: "Translation Lookaside Buffer (TLB)",
    question: "What is the primary role of the Translation Lookaside Buffer (TLB) in virtual memory?",
    options: [
      "A fast hardware cache for virtual-to-physical address translations",
      "A buffer storing dirty pages before writing back to disk",
      "A software queue that tracks page faults in the kernel",
      "A register that stores the process base address"
    ],
    correctAnswer: "A fast hardware cache for virtual-to-physical address translations",
    explanation: "The TLB is an associative hardware cache inside the MMU that stores recent virtual-to-physical page mappings to avoid full page table walks in RAM.",
    hint: "It avoids secondary memory lookups when translating virtual addresses."
  },
  {
    id: "os-10",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Virtual Memory",
    title: "Thrashing Phenomenon",
    question: "What causes 'Thrashing' in an operating system?",
    options: [
      "The CPU spending more time paging in/out than executing user instructions",
      "A high frequency of hardware timer interrupts from the motherboard",
      "Multiple threads contending on a single spinning mutex lock",
      "Corrupt disk sectors forcing recursive bad-block remapping"
    ],
    correctAnswer: "The CPU spending more time paging in/out than executing user instructions",
    explanation: "Thrashing occurs when the total working set of active processes exceeds physical RAM, causing continuous page faults and near-zero CPU throughput.",
    hint: "The page fault rate spikes so high that the CPU sits idle waiting on disk I/O."
  },
  {
    id: "os-11",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Process Synchronization",
    title: "Critical Section Requirements",
    question: "Which of the following is a mandatory condition for any valid solution to the Critical Section problem?",
    options: [
      "Mutual Exclusion, Progress, and Bounded Waiting",
      "Preemption, Aging, and Priority Inversion",
      "First Come First Served and Hardware Atomicity only",
      "Multi-core execution and busy waiting"
    ],
    correctAnswer: "Mutual Exclusion, Progress, and Bounded Waiting",
    explanation: "A valid solution must satisfy: 1) Mutual Exclusion (only one process inside), 2) Progress (selection cannot be postponed indefinitely), and 3) Bounded Waiting.",
    hint: "Three classic criteria formalize critical section safety and fairness."
  },
  {
    id: "os-12",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Concurrency",
    title: "Priority Inversion & Priority Inheritance",
    question: "How does an operating system typically resolve the Priority Inversion problem?",
    options: [
      "Priority Inheritance Protocol",
      "Round Robin time slice reduction",
      "Preempting all kernel mode operations",
      "Terminating the lowest-priority process"
    ],
    correctAnswer: "Priority Inheritance Protocol",
    explanation: "Under Priority Inheritance, a lower-priority task holding a lock needed by a high-priority task temporarily inherits that high priority to prevent medium-priority tasks from stalling both.",
    hint: "The low-priority lock holder temporarily borrows higher standing."
  },
  {
    id: "os-13",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Disk Scheduling",
    title: "SCAN (Elevator) Disk Algorithm",
    question: "Why is the SCAN disk scheduling algorithm commonly referred to as the Elevator algorithm?",
    options: [
      "The disk arm moves in one direction servicing requests until the end, then reverses",
      "It always services the request closest to the current head position",
      "It services requests in exact FIFO order regardless of head track position",
      "It jumps directly to cylinder zero after every read request"
    ],
    correctAnswer: "The disk arm moves in one direction servicing requests until the end, then reverses",
    explanation: "Like a passenger elevator, SCAN moves the disk head continuously across tracks in one direction, servicing requests, until reaching the end where it reverses.",
    hint: "Think about an elevator servicing floors on its way up, then reversing down."
  },
  {
    id: "os-14",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Memory Management",
    title: "Internal vs External Fragmentation",
    question: "Which memory management scheme primarily suffers from internal fragmentation rather than external fragmentation?",
    options: [
      "Fixed-size Paging",
      "Variable-size Dynamic Partitioning",
      "Pure Segmentation",
      "Buddy Allocation with unbounded splitting"
    ],
    correctAnswer: "Fixed-size Paging",
    explanation: "In paging, memory is allocated in fixed-size frames (e.g. 4KB). If a process requires 5KB, it gets two 4KB pages (8KB total), leaving 3KB unused inside the second frame (internal fragmentation).",
    hint: "Allocating fixed-size blocks leaves wasted space within the allocated unit."
  },
  {
    id: "os-15",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Processes & Threads",
    title: "Orphan Process Adoption",
    question: "When a parent process terminates before its child process exits, what happens to the child process?",
    options: [
      "It becomes an orphan and is adopted by the init / systemd process (PID 1)",
      "It is terminated immediately by the operating system kernel",
      "It enters an unrecoverable kernel panic state",
      "It is suspended indefinitely until the system reboots"
    ],
    correctAnswer: "It becomes an orphan and is adopted by the init / systemd process (PID 1)",
    explanation: "Orphaned processes are adopted by PID 1 (init or systemd in modern Linux), which periodically calls wait() to reap their exit codes.",
    hint: "The root ancestor process with PID 1 takes guardianship."
  },
  {
    id: "os-16",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Memory Management",
    title: "Inverted Page Table",
    question: "What is the primary advantage of an Inverted Page Table over a traditional multi-level hierarchical page table?",
    options: [
      "It scales with the size of physical memory rather than virtual address space",
      "It eliminates the need for a Translation Lookaside Buffer (TLB)",
      "It provides O(1) direct indexing without hash tables",
      "It completely eliminates both internal and external fragmentation"
    ],
    correctAnswer: "It scales with the size of physical memory rather than virtual address space",
    explanation: "An inverted page table has one entry per physical frame instead of per virtual page, keeping table size small even for huge 64-bit virtual address spaces.",
    hint: "Number of entries is proportional to physical frames, not virtual pages."
  },
  {
    id: "os-17",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Operating System Architecture",
    title: "Kernel Mode vs User Mode",
    question: "What hardware mechanism allows the CPU to switch from User Mode to Kernel Mode securely?",
    options: [
      "Software trap / system call interrupt",
      "Direct jump to arbitrary kernel memory address",
      "Overwriting the stack pointer register with null",
      "Disabling hardware clocks"
    ],
    correctAnswer: "Software trap / system call interrupt",
    explanation: "User applications execute a trap instruction (or sysenter/syscall instruction), triggering a controlled hardware mode switch to pre-configured kernel dispatch tables.",
    hint: "A software trap or interrupt vector transitions CPU privilege."
  },
  {
    id: "os-18",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Processes & Threads",
    title: "Context Switching Cost",
    question: "Why is a thread context switch generally faster than a full process context switch?",
    options: [
      "Threads share the same virtual address space, avoiding TLB invalidation",
      "Threads execute without using hardware registers",
      "Threads run exclusively on the CPU cache without main memory access",
      "Threads bypass the operating system kernel scheduler entirely"
    ],
    correctAnswer: "Threads share the same virtual address space, avoiding TLB invalidation",
    explanation: "Switching between threads of the same process keeps the same page table (CR3 in x86), avoiding costly TLB flushes and memory map reconfiguration.",
    hint: "No new page directory or address space swap is needed."
  },
  {
    id: "os-19",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "CPU Scheduling",
    title: "Round Robin Quantum Tradeoff",
    question: "In Round Robin scheduling, what happens if the time quantum is chosen to be extremely large?",
    options: [
      "The scheduling behavior degenerates into First-Come, First-Served (FCFS)",
      "Context switching overhead consumes 100% of CPU time",
      "Processes with short burst times get starved indefinitely",
      "The system automatically switches to Shortest Job First"
    ],
    correctAnswer: "The scheduling behavior degenerates into First-Come, First-Served (FCFS)",
    explanation: "If the time quantum exceeds the longest process burst time, each process runs to completion on its first turn, identical to FCFS.",
    hint: "Each process gets enough time to finish before its quantum expires."
  },
  {
    id: "os-20",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Process Synchronization",
    title: "Peterson's Algorithm",
    question: "Peterson's Algorithm guarantees mutual exclusion for how many concurrent processes?",
    options: [
      "Exactly 2 processes",
      "Unlimited arbitrary processes",
      "Up to 2^16 processes",
      "Any number of processes on symmetric multiprocessors without memory barriers"
    ],
    correctAnswer: "Exactly 2 processes",
    explanation: "Classic Peterson's Algorithm is a software-based critical section solution designed strictly for 2 cooperating processes using shared turn and flag variables.",
    hint: "It solves mutual exclusion specifically between two processes."
  },
  {
    id: "os-21",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Virtual Memory",
    title: "Working Set Model",
    question: "The Working Set Model of a process is primarily designed to prevent:",
    options: [
      "Thrashing by tracking active page references over time window delta",
      "Race conditions between child threads sharing heap memory",
      "Deadlock during multi-resource acquisition",
      "Stack overflow during deep recursion"
    ],
    correctAnswer: "Thrashing by tracking active page references over time window delta",
    explanation: "The Working Set Model tracks the set of pages referenced by a process during a sliding time window (delta) to ensure adequate frames are granted, preventing thrashing.",
    hint: "It models the locality of page references over time."
  },
  {
    id: "os-22",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Process Synchronization",
    title: "Spinlock Behavior",
    question: "A spinlock is most appropriate when:",
    options: [
      "Wait times are expected to be extremely short on multi-core systems",
      "The thread needs to wait on a slow disk I/O operation",
      "Running on a single-core uniprocessor system",
      "The thread expects to sleep for several seconds"
    ],
    correctAnswer: "Wait times are expected to be extremely short on multi-core systems",
    explanation: "Spinlocks keep the CPU busy-waiting in a loop. When locks are held for brief nanoseconds, spinning avoids the heavy overhead of context switching and thread suspension.",
    hint: "Context switches cost more than a few CPU cycles of spinning."
  },
  {
    id: "os-23",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "File Systems",
    title: "Inode Structure in Unix",
    question: "What piece of file information is typically NOT stored directly inside a Unix inode?",
    options: [
      "File name",
      "File size",
      "File owner UID and permissions",
      "Pointers to data disk blocks"
    ],
    correctAnswer: "File name",
    explanation: "File names are stored in directory files as key-value pairs (filename -> inode number). The inode itself stores metadata (size, owner, permissions, timestamps, data block pointers).",
    hint: "Directory entries map human-readable names to inode numbers."
  },
  {
    id: "os-24",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Memory Management",
    title: "Copy-On-Write (COW)",
    question: "How does the Copy-On-Write (COW) optimization optimize the fork() system call?",
    options: [
      "Parent and child share physical memory pages marked read-only until one writes to a page",
      "It completely disables memory allocation for child processes",
      "It copies all heap memory synchronously while leaving the stack uncopied",
      "It uses disk swap space as the immediate backing store for new child pages"
    ],
    correctAnswer: "Parent and child share physical memory pages marked read-only until one writes to a page",
    explanation: "With COW, fork() duplicates only page tables with read-only permissions. A physical page copy is created only when either process attempts to write to that page.",
    hint: "Pages are duplicated only when a write operation triggers a page fault."
  },
  {
    id: "os-25",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "CPU Scheduling",
    title: "Starvation in Priority Scheduling",
    question: "What technique is used by operating systems to solve starvation of low-priority processes?",
    options: [
      "Aging (gradually increasing process priority as it waits)",
      "Immediate round-robin preemption after 1ms",
      "Elevating all processes to real-time priority",
      "Random process selection"
    ],
    correctAnswer: "Aging (gradually increasing process priority as it waits)",
    explanation: "Aging progressively increases the priority of waiting processes over time, guaranteeing that even low-priority jobs eventually run.",
    hint: "Priority grows as a process gets older in the wait queue."
  },
  {
    id: "os-26",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Inter-Process Communication",
    title: "Anonymous Pipe Communication",
    question: "A standard anonymous pipe created via pipe() in Unix provides:",
    options: [
      "Unidirectional communication between related processes (e.g. parent and child)",
      "Bidirectional networked communication between arbitrary remote machines",
      "Asynchronous broadcast messaging across all logged-in users",
      "Persistent file storage on secondary disk"
    ],
    correctAnswer: "Unidirectional communication between related processes (e.g. parent and child)",
    explanation: "Standard anonymous pipes are unidirectional byte streams with two file descriptors (read end and write end) shared between related processes via inheritance.",
    hint: "Data flows in one direction between parent and child."
  },
  {
    id: "os-27",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "CPU Scheduling",
    title: "Multilevel Feedback Queue (MLFQ)",
    question: "What is a defining characteristic of a Multilevel Feedback Queue (MLFQ) scheduler?",
    options: [
      "Processes can move between priority queues based on their observed CPU burst behavior",
      "Every queue uses the exact same time quantum length",
      "Processes are permanently assigned to a static queue upon creation",
      "It requires advance knowledge of each process total execution time"
    ],
    correctAnswer: "Processes can move between priority queues based on their observed CPU burst behavior",
    explanation: "MLFQ dynamically adjusts process priority: CPU-bound processes drop to lower queues with longer quanta, while I/O-bound interactive processes remain in top priority queues.",
    hint: "The scheduler learns from past behavior and shifts jobs between queues."
  },
  {
    id: "os-28",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Processes & Threads",
    title: "Process Control Block (PCB)",
    question: "Which data structure is maintained by the operating system kernel for every active process?",
    options: [
      "Process Control Block (PCB)",
      "File Allocation Table (FAT)",
      "Direct Memory Access Table (DMAT)",
      "Interrupt Vector Table (IVT)"
    ],
    correctAnswer: "Process Control Block (PCB)",
    explanation: "The OS kernel maintains a PCB for each process, storing its PID, state, program counter, CPU registers, CPU scheduling info, and open file descriptors.",
    hint: "It holds all metadata needed to pause and resume a process."
  },
  {
    id: "os-29",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Process Synchronization",
    title: "Deadlock Detection Algorithm",
    question: "In a system with single instances of each resource type, deadlock can be detected by finding a cycle in the:",
    options: [
      "Wait-For Graph (WFG)",
      "B-Tree disk index",
      "Virtual address page table",
      "State transition diagram"
    ],
    correctAnswer: "Wait-For Graph (WFG)",
    explanation: "By collapsing resource nodes from the Resource Allocation Graph, a cycle in a Wait-For Graph (where nodes are processes) strictly indicates a deadlock for single-instance resources.",
    hint: "A cycle in this directed graph of waiting processes proves deadlock."
  },
  {
    id: "os-30",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Memory Management",
    title: "Page Fault Handling",
    question: "When a page fault interrupt occurs, what does the operating system do first?",
    options: [
      "Check if the memory reference was valid and locate the desired page on backing store/disk",
      "Terminate the faulting process immediately with a segmentation fault",
      "Clear the Translation Lookaside Buffer and restart the entire system",
      "Allocate all free physical RAM to the faulting process"
    ],
    correctAnswer: "Check if the memory reference was valid and locate the desired page on backing store/disk",
    explanation: "The kernel traps the page fault, validates that the virtual address belongs to the process's allocated space, finds a free frame (or evicts one), and schedules disk I/O to fetch the page.",
    hint: "First verify the access is legal, then read the missing page from disk."
  },
  {
    id: "os-31",
    gameType: "os-quiz",
    difficulty: "EASY",
    category: "Operating System Architecture",
    title: "Microkernel vs Monolithic Kernel",
    question: "Which of the following services is typically moved to user space in a microkernel architecture?",
    options: [
      "File systems and device drivers",
      "Basic inter-process communication (IPC)",
      "Low-level CPU context switching",
      "Core virtual memory address translation"
    ],
    correctAnswer: "File systems and device drivers",
    explanation: "Microkernels keep only minimal mechanisms (IPC, basic scheduling, virtual memory) in kernel space. File systems, network stacks, and device drivers run as user-mode servers.",
    hint: "Microkernels minimize kernel code by pushing drivers and file systems to user space."
  },
  {
    id: "os-32",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Disk Scheduling",
    title: "C-SCAN vs SCAN",
    question: "What distinguishes Circular SCAN (C-SCAN) from standard SCAN disk scheduling?",
    options: [
      "C-SCAN returns directly to the beginning of the disk without servicing requests on the return trip",
      "C-SCAN services requests in random order to prevent starvation",
      "C-SCAN reverses head direction at the last requested cylinder rather than the disk edge",
      "C-SCAN prioritizes writes over reads"
    ],
    correctAnswer: "C-SCAN returns directly to the beginning of the disk without servicing requests on the return trip",
    explanation: "C-SCAN provides more uniform waiting times by treating cylinders as a circular list: it sweeps one way servicing requests, then immediately returns to the start without servicing on the return.",
    hint: "Circular scanning only services requests in one direction."
  },
  {
    id: "os-33",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Processes & Threads",
    title: "fork() Output Code Analysis",
    question: "What is printed by this code assuming fork() succeeds?\n```c\nint val = 5;\nif (fork() == 0) {\n    val += 15;\n} else {\n    wait(NULL);\n    printf(\"%d\", val);\n}\n```",
    options: [
      "5",
      "20",
      "0",
      "Undefined behavior"
    ],
    correctAnswer: "5",
    explanation: "Parent and child have separate address spaces. The child modifies its own copy of `val` (becoming 20), while the parent's `val` remains 5.",
    hint: "Child and parent processes operate in independent memory spaces."
  },
  {
    id: "os-34",
    gameType: "os-quiz",
    difficulty: "MEDIUM",
    category: "Process Synchronization",
    title: "Compare-And-Swap (CAS) Instruction",
    question: "What makes hardware atomic instructions like Compare-And-Swap (CAS) or Test-And-Set critical for OS kernels?",
    options: [
      "They allow lock-free synchronization by atomically inspecting and updating memory without interruption",
      "They execute 100 times faster than simple CPU arithmetic instructions",
      "They enable user mode processes to write directly to kernel page tables",
      "They eliminate the need for CPU cache coherence protocols"
    ],
    correctAnswer: "They allow lock-free synchronization by atomically inspecting and updating memory without interruption",
    explanation: "Atomic hardware instructions guarantee that read-modify-write operations happen as an indivisible unit across all cores, preventing race conditions without disabling interrupts.",
    hint: "Atomicity guarantees indivisible read-and-write across cores."
  },
  {
    id: "os-35",
    gameType: "os-quiz",
    difficulty: "HARD",
    category: "Memory Management",
    title: "Two-Level Paging Address Calculation",
    question: "In a 32-bit system with 4KB pages where each page table entry is 4 bytes, how large is a single top-level page directory with 10-bit index?",
    options: [
      "4 KB (1024 entries * 4 bytes)",
      "4 MB",
      "1 MB",
      "64 KB"
    ],
    correctAnswer: "4 KB (1024 entries * 4 bytes)",
    explanation: "A 10-bit index addresses 2^10 = 1024 entries. At 4 bytes per entry, the entire page directory fits in exactly 1024 * 4 = 4096 bytes (4 KB), matching one physical frame.",
    hint: "2^10 entries multiplied by 4 bytes per entry."
  }
];

module.exports = { osQuestions };

