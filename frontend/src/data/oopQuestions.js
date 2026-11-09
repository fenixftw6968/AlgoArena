/**
 * MindForge - oopQuestions
 * Exactly 35 verified high-quality MCQ questions.
 */

export const oopQuestions = [
  {
    "id": "oop-1",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Encapsulation Definition",
    "question": "What is the primary objective of Encapsulation in Object-Oriented Programming?",
    "options": [
      "Bundling data attributes and manipulating methods together while restricting direct access to internal state",
      "Allowing child classes to override methods defined in parent classes",
      "Enabling a single interface to represent multiple distinct types",
      "Decomposing large functions into smaller independent procedures"
    ],
    "correctAnswer": "Bundling data attributes and manipulating methods together while restricting direct access to internal state",
    "explanation": "Encapsulation wraps data and methods operating on that data into a single unit (class) and hides internal representation via access modifiers (private/protected).",
    "hint": "Combines data and methods and hides internal details via private members."
  },
  {
    "id": "oop-2",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Polymorphism",
    "title": "Method Overloading vs Overriding",
    "question": "What distinguishes Method Overloading from Method Overriding?",
    "options": [
      "Overloading is compile-time polymorphism with different method signatures; Overriding is runtime polymorphism in sub-classes",
      "Overloading happens strictly across inheritance hierarchies; Overriding happens in the same class",
      "Overriding requires static methods, while Overloading requires virtual methods",
      "Overloading changes object memory addresses at runtime"
    ],
    "correctAnswer": "Overloading is compile-time polymorphism with different method signatures; Overriding is runtime polymorphism in sub-classes",
    "explanation": "Method Overloading allows multiple methods in the same class with the same name but different parameter signatures (static dispatch). Overriding redefines a parent method in a child class with the same signature (dynamic dispatch).",
    "hint": "One is resolved at compile time with different parameters; the other is resolved at runtime across parent-child classes."
  },
  {
    "id": "oop-3",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Abstract Class vs Interface",
    "question": "What is a key difference between an Abstract Class and an Interface in languages like Java or C++?",
    "options": [
      "An abstract class can maintain state (instance fields) and constructors, whereas standard interfaces define behavior contracts",
      "A class can inherit multiple abstract classes, but only implement one interface",
      "Interfaces can define private non-static variables, abstract classes cannot",
      "Abstract classes cannot have any implemented method bodies"
    ],
    "correctAnswer": "An abstract class can maintain state (instance fields) and constructors, whereas standard interfaces define behavior contracts",
    "explanation": "Abstract classes can hold instance state, constructors, and default implementations, representing an 'is-a' relationship. Interfaces primarily define abstract behavior contracts ('can-do').",
    "hint": "Abstract classes can have instance variables and constructors; interfaces define contracts."
  },
  {
    "id": "oop-4",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Polymorphism & Dispatch",
    "title": "Virtual Method Table (vtable)",
    "question": "How does the C++ compiler achieve dynamic runtime polymorphism for virtual functions?",
    "options": [
      "Through a hidden per-class Virtual Method Table (vtable) and a per-instance vpointer (vptr)",
      "By re-compiling the function bytecodes dynamically at runtime",
      "By using global string lookups on function identifiers",
      "By allocating separate CPU registers for derived classes"
    ],
    "correctAnswer": "Through a hidden per-class Virtual Method Table (vtable) and a per-instance vpointer (vptr)",
    "explanation": "Classes containing virtual functions have a vtable containing pointers to the actual method implementations. Each instance has a vptr pointing to its class vtable for O(1) runtime function resolution.",
    "hint": "Each instance carries a pointer to a table of function pointers."
  },
  {
    "id": "oop-5",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "SOLID Principles",
    "title": "Liskov Substitution Principle (LSP)",
    "question": "According to the Liskov Substitution Principle (LSP) in SOLID design:",
    "options": [
      "Derived classes must be substitutable for their base classes without altering the correctness of the program",
      "Classes should be open for modification and closed for extension",
      "Clients should be forced to depend on broad interfaces containing methods they do not use",
      "High-level modules should depend directly on concrete low-level implementations"
    ],
    "correctAnswer": "Derived classes must be substitutable for their base classes without altering the correctness of the program",
    "explanation": "LSP states that objects of a superclass should be replaceable with objects of a subclass without breaking application behavior or violating class invariants (e.g. Square inheriting Rectangle issue).",
    "hint": "Subtypes must preserve the expected contracts and invariants of the base type."
  },
  {
    "id": "oop-6",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Inheritance",
    "title": "Diamond Problem in Multiple Inheritance",
    "question": "What is the 'Diamond Problem' in multiple inheritance?",
    "options": [
      "Ambiguity that arises when a class inherits from two parent classes that both derive from the same common ancestor",
      "An unresolvable deadlock between two concurrent class loaders",
      "Excessive memory consumption caused by nested diamond structures in heaps",
      "A compiler error when instantiating more than four child objects"
    ],
    "correctAnswer": "Ambiguity that arises when a class inherits from two parent classes that both derive from the same common ancestor",
    "explanation": "When Class D inherits from B and C, which both inherit from A, D receives duplicate copies of A's fields and methods, causing ambiguity. C++ resolves this via virtual base classes (`virtual inheritance`).",
    "hint": "Two parent classes inherit from the same grandparent, causing duplicate paths to ancestor methods."
  },
  {
    "id": "oop-7",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Memory & Destructors",
    "title": "Virtual Destructor Importance",
    "question": "Why should a base class destructor always be declared `virtual` in C++ when derived classes are deleted via base pointers?",
    "options": [
      "To ensure the derived class destructor executes first, preventing memory and resource leaks",
      "To speed up object heap allocation time by 50%",
      "To prevent private fields from being serialized",
      "To force derived classes to remain abstract"
    ],
    "correctAnswer": "To ensure the derived class destructor executes first, preventing memory and resource leaks",
    "explanation": "If a base destructor is non-virtual, calling `delete basePtr` will only invoke Base::~Base(), skipping the Derived::~Derived() destructor and leaking derived resources.",
    "hint": "Without it, deleting derived objects through a base pointer only runs the base destructor."
  },
  {
    "id": "oop-8",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Thread-Safe Singleton Pattern",
    "question": "In the Double-Checked Locking implementation of the Singleton pattern, why must the instance variable be marked `volatile` (or use memory fences)?",
    "options": [
      "To prevent instruction reordering that could expose a partially constructed object to other threads",
      "To guarantee that the singleton object is created on the CPU L1 cache",
      "To force the singleton to be garbage collected immediately after use",
      "To enable automatic deep cloning of the singleton instance"
    ],
    "correctAnswer": "To prevent instruction reordering that could expose a partially constructed object to other threads",
    "explanation": "Without `volatile`, the compiler or CPU can reorder the constructor execution and the pointer assignment: another thread could observe a non-null reference before fields are fully initialized.",
    "hint": "Prevents memory reordering from publishing an incomplete object to other threads."
  },
  {
    "id": "oop-9",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "SOLID Principles",
    "title": "Single Responsibility Principle (SRP)",
    "question": "The Single Responsibility Principle (SRP) states that:",
    "options": [
      "A class should have one, and only one, reason to change",
      "Every class must contain only a single public method",
      "Software entities should be open for modification but closed for extension",
      "Only one engineer should commit code to a class repository at a time"
    ],
    "correctAnswer": "A class should have one, and only one, reason to change",
    "explanation": "Robert C. Martin formulated SRP: a class should encapsulate a single responsibility, meaning it has only one actor or reason that would necessitate a change.",
    "hint": "A module or class should be responsible to only one single actor."
  },
  {
    "id": "oop-10",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Design Patterns",
    "title": "Observer Pattern",
    "question": "The Observer pattern is primarily used to:",
    "options": [
      "Define a one-to-many dependency so that when one object changes state, all dependents are notified automatically",
      "Convert the interface of a class into another interface clients expect",
      "Ensure a class has only one instance while providing a global access point",
      "Dynamically attach additional responsibilities to an object without subclassing"
    ],
    "correctAnswer": "Define a one-to-many dependency so that when one object changes state, all dependents are notified automatically",
    "explanation": "Observer establishes a publish-subscribe relationship: subjects maintain a list of observers and broadcast state changes by invoking observer update methods.",
    "hint": "Publish-subscribe pattern for notifying multiple listening objects of changes."
  },
  {
    "id": "oop-11",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Adapter vs Decorator Pattern",
    "question": "What is the structural and conceptual difference between the Adapter and Decorator design patterns?",
    "options": [
      "Adapter changes the interface to match client expectations; Decorator preserves the interface while adding behavior",
      "Adapter creates new instances; Decorator clones existing prototypes",
      "Decorator changes method parameter types; Adapter wraps network sockets",
      "There is no difference; they are exact synonyms in the Gang of Four catalog"
    ],
    "correctAnswer": "Adapter changes the interface to match client expectations; Decorator preserves the interface while adding behavior",
    "explanation": "Adapter converts an incompatible interface into one the client understands without altering functionality. Decorator implements the same interface to transparently add responsibilities.",
    "hint": "One adapts an incompatible interface; the other enhances behavior while keeping the same interface."
  },
  {
    "id": "oop-12",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Code Output",
    "title": "C++ Constructor Execution Order",
    "question": "Consider the C++ code:\n```cpp\nclass Base { public: Base() { cout << \"B\"; } };\nclass Derived : public Base { public: Derived() { cout << \"D\"; } };\nint main() { Derived obj; }\n```\nWhat is printed?",
    "options": [
      "BD",
      "DB",
      "D",
      "B"
    ],
    "correctAnswer": "BD",
    "explanation": "In inheritance, the base class constructor is always invoked before the derived class constructor body executes. Therefore, Base prints 'B' then Derived prints 'D'.",
    "hint": "Base constructors run before derived constructors."
  },
  {
    "id": "oop-13",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Four Pillars",
    "title": "Composition over Inheritance",
    "question": "Why is 'Favor Composition over Inheritance' widely recognized as an OOP best practice?",
    "options": [
      "Composition provides loose coupling and permits dynamic runtime behavior changes, whereas inheritance is rigid and breaks encapsulation",
      "Composition eliminates the need for unit testing",
      "Inherited classes execute 10 times slower due to compiler overhead",
      "Modern object-oriented languages have deprecated the `extends` keyword"
    ],
    "correctAnswer": "Composition provides loose coupling and permits dynamic runtime behavior changes, whereas inheritance is rigid and breaks encapsulation",
    "explanation": "Inheritance creates a tight compile-time coupling ('white-box reuse') that exposes internal base details. Composition ('has-a') encapsulates behavior and allows changing components at runtime.",
    "hint": "'Has-a' relationships are more flexible and loosely coupled than 'is-a' hierarchies."
  },
  {
    "id": "oop-14",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Polymorphism & Dispatch",
    "title": "C++ Virtual Function Shadowing / Slicing",
    "question": "In C++, what is Object Slicing?",
    "options": [
      "When a derived class object is assigned by value to a base class object, stripping away the derived attributes and polymorphic behavior",
      "Splitting a large monolithic class into two smaller interfaces",
      "Corrupting memory when deleting an array using single pointer `delete`",
      "Dynamically truncating strings stored in private member fields"
    ],
    "correctAnswer": "When a derived class object is assigned by value to a base class object, stripping away the derived attributes and polymorphic behavior",
    "explanation": "Assigning a Derived object to a Base object by value copies only the Base sub-object into Base storage. The Derived members and vptr are 'sliced' off.",
    "hint": "Assigning by value to a base object copies only the base slice of the object."
  },
  {
    "id": "oop-15",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Access Specifiers in OOP",
    "question": "Which access specifier makes class members accessible within the class itself and by derived subclasses, but hidden from the outside world?",
    "options": [
      "protected",
      "private",
      "public",
      "internal static"
    ],
    "correctAnswer": "protected",
    "explanation": "Private is accessible only in the declaring class. Protected permits access to subclasses/derived classes, but restricts external callers. Public is open to all.",
    "hint": "Allows subclasses to access members while hiding them from external clients."
  },
  {
    "id": "oop-16",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Strategy Design Pattern",
    "question": "Which design principle does the Strategy Pattern directly implement?",
    "options": [
      "Open/Closed Principle by defining a family of interchangeable algorithms and encapsulating each behind a common interface",
      "Creating global singletons for state management",
      "Hardcoding behavior inside switch-case branches",
      "Recursive object tree traversal"
    ],
    "correctAnswer": "Open/Closed Principle by defining a family of interchangeable algorithms and encapsulating each behind a common interface",
    "explanation": "The Strategy pattern encapsulates interchangeable algorithms behind an interface, enabling new algorithms to be introduced without modifying existing client classes.",
    "hint": "Encapsulates a family of algorithms so the client can swap them dynamically."
  },
  {
    "id": "oop-17",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "SOLID Principles",
    "title": "Dependency Inversion Principle (DIP)",
    "question": "What is the core mandate of the Dependency Inversion Principle (DIP)?",
    "options": [
      "High-level modules should not depend on low-level modules; both should depend on abstractions",
      "Subclasses must invert parent method return values",
      "All functions should accept null parameters by default",
      "Dependencies should be declared inside constructors using concrete classes"
    ],
    "correctAnswer": "High-level modules should not depend on low-level modules; both should depend on abstractions",
    "explanation": "DIP states: High-level business logic should depend on abstractions/interfaces rather than concrete implementations, decoupling modules from volatile low-level details.",
    "hint": "Depend upon abstractions, not concrete implementations."
  },
  {
    "id": "oop-18",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Shallow Copy vs Deep Copy",
    "question": "What occurs during a Shallow Copy of an object containing pointers to dynamically allocated memory?",
    "options": [
      "Only the pointer addresses are copied, resulting in two objects referencing the exact same heap memory",
      "A completely independent duplicate of the heap memory is allocated",
      "The original object is cleared and nulled out",
      "The heap memory is encrypted on disk"
    ],
    "correctAnswer": "Only the pointer addresses are copied, resulting in two objects referencing the exact same heap memory",
    "explanation": "A shallow copy duplicates primitive fields and pointer addresses. Because both pointers point to the same memory block, modifying or deleting one affects the other (double free risk).",
    "hint": "Copies the pointers, but not the actual data they point to."
  },
  {
    "id": "oop-19",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Code Output",
    "title": "C++ Virtual Function Call Analysis",
    "question": "What is printed by this code?\n```cpp\nclass Animal {\npublic:\n    virtual void speak() { cout << \"A\"; }\n};\nclass Dog : public Animal {\npublic:\n    void speak() override { cout << \"D\"; }\n};\nint main() {\n    Animal* a = new Dog();\n    a->speak();\n}\n```",
    "options": [
      "D",
      "A",
      "AD",
      "Compilation Error"
    ],
    "correctAnswer": "D",
    "explanation": "Because `speak()` is declared virtual in Animal, the call `a->speak()` resolves through Dog's vtable at runtime, executing Dog::speak() and printing 'D'.",
    "hint": "Virtual methods use dynamic dispatch based on the actual runtime object."
  },
  {
    "id": "oop-20",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Factory Method vs Abstract Factory",
    "question": "What distinguishes the Abstract Factory pattern from the Factory Method pattern?",
    "options": [
      "Abstract Factory creates entire families of related or dependent objects without specifying concrete classes; Factory Method uses a single method to create one product",
      "Factory Method uses multiple classes while Abstract Factory is restricted to a single static function",
      "Abstract Factory requires thread locks on all creations",
      "Factory Method can only instantiate primitive types"
    ],
    "correctAnswer": "Abstract Factory creates entire families of related or dependent objects without specifying concrete classes; Factory Method uses a single method to create one product",
    "explanation": "Factory Method delegates creation of a single product to subclasses via an inherited method. Abstract Factory provides an interface to create families of related products (e.g. DarkThemeButton, DarkThemeScrollbar).",
    "hint": "Abstract factory creates entire families of related products."
  },
  {
    "id": "oop-21",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "SOLID Principles",
    "title": "Interface Segregation Principle (ISP)",
    "question": "The Interface Segregation Principle (ISP) states that:",
    "options": [
      "Clients should not be forced to depend on methods they do not use (prefer small, focused interfaces)",
      "Interfaces must never inherit from other interfaces",
      "Every interface must declare at least 10 abstract methods",
      "Classes must implement every interface in a package"
    ],
    "correctAnswer": "Clients should not be forced to depend on methods they do not use (prefer small, focused interfaces)",
    "explanation": "ISP recommends fine-grained, role-specific interfaces over bloated 'fat' interfaces, so implementing classes aren't burdened with dummy or unsupported methods.",
    "hint": "Many client-specific interfaces are better than one general-purpose interface."
  },
  {
    "id": "oop-22",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Static Methods and 'this' Pointer",
    "question": "Why can static member methods in OOP languages NOT access the `this` pointer or non-static member variables directly?",
    "options": [
      "Static methods belong to the class type itself, not to any particular object instance",
      "Static methods run inside the operating system kernel",
      "Static methods cannot return values",
      "Static methods are only executed at compilation time"
    ],
    "correctAnswer": "Static methods belong to the class type itself, not to any particular object instance",
    "explanation": "Static methods exist at class-scope and can be invoked without instantiating any object (`ClassName::method()`). Since there is no calling instance, `this` does not exist.",
    "hint": "Static methods are associated with the class, not an instantiated object."
  },
  {
    "id": "oop-23",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Command Pattern Decoupling",
    "question": "In the Command Design Pattern, what is encapsulated into a standalone command object?",
    "options": [
      "All information needed to perform an action (the receiver object, method name, and arguments), enabling undo/redo and queuing",
      "A database connection pool and socket buffer",
      "A thread pool scheduler configuration",
      "A complete binary serialization of the operating system PCB"
    ],
    "correctAnswer": "All information needed to perform an action (the receiver object, method name, and arguments), enabling undo/redo and queuing",
    "explanation": "The Command pattern turns requests into objects, allowing you to parameterize clients with different requests, queue or log requests, and support undoable operations.",
    "hint": "Encapsulates a request as an object, making it easy to queue or undo."
  },
  {
    "id": "oop-24",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Polymorphism & Dispatch",
    "title": "Pure Virtual Function & Abstract Class",
    "question": "In C++, how is a function made a 'pure virtual function', turning the class into an abstract class?",
    "options": [
      "By affixing `= 0` to its virtual function declaration (e.g. `virtual void draw() = 0;`)",
      "By adding the `abstract` keyword before the return type",
      "By leaving the function body completely empty with `{}`",
      "By declaring the method private and static"
    ],
    "correctAnswer": "By affixing `= 0` to its virtual function declaration (e.g. `virtual void draw() = 0;`)",
    "explanation": "In C++, writing `= 0` marks a virtual function as pure. Any class containing at least one pure virtual function cannot be directly instantiated.",
    "hint": "The `= 0` syntax defines a pure virtual method in C++."
  },
  {
    "id": "oop-25",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Inheritance",
    "title": "IS-A vs HAS-A Relationship",
    "question": "Which OOP concepts model the 'IS-A' and 'HAS-A' relationships respectively?",
    "options": [
      "Inheritance represents 'IS-A', while Composition represents 'HAS-A'",
      "Polymorphism represents 'IS-A', while Encapsulation represents 'HAS-A'",
      "Composition represents 'IS-A', while Inheritance represents 'HAS-A'",
      "Overloading represents 'IS-A', while Overriding represents 'HAS-A'"
    ],
    "correctAnswer": "Inheritance represents 'IS-A', while Composition represents 'HAS-A'",
    "explanation": "A Car 'IS-A' Vehicle (Inheritance). A Car 'HAS-A' Engine (Composition).",
    "hint": "Inheritance is 'is-a'; composition is 'has-a'."
  },
  {
    "id": "oop-26",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Memory Management",
    "title": "RAII (Resource Acquisition Is Initialization)",
    "question": "What core guarantee does RAII provide in modern C++?",
    "options": [
      "Resources acquired in a constructor are deterministically released when the object goes out of scope via its destructor",
      "All memory is automatically allocated on CPU cache lines",
      "Garbage collection sweeps unreferenced objects every 10 milliseconds",
      "Pointers can never point to null memory"
    ],
    "correctAnswer": "Resources acquired in a constructor are deterministically released when the object goes out of scope via its destructor",
    "explanation": "RAII binds the lifecycle of resources (heap memory, file handles, mutex locks) to object lifetime, ensuring deterministic cleanup even when exceptions are thrown.",
    "hint": "Destructors automatically clean up resources when scope exits."
  },
  {
    "id": "oop-27",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Design Patterns",
    "title": "Proxy Design Pattern",
    "question": "What is the primary role of a Proxy pattern?",
    "options": [
      "Providing a surrogate or placeholder for another object to control access, lazy-load, or log operations",
      "Iterating through a complex data structure without exposing internal fields",
      "Transforming incompatible interfaces between third-party libraries",
      "Splitting an object into two parallel class hierarchies"
    ],
    "correctAnswer": "Providing a surrogate or placeholder for another object to control access, lazy-load, or log operations",
    "explanation": "A Proxy acts as an intermediary controlling access to a real subject (e.g. Virtual Proxy for lazy loading, Protection Proxy for auth checks, Remote Proxy for RPC).",
    "hint": "A surrogate that controls access to the underlying object."
  },
  {
    "id": "oop-28",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Constructor Overloading",
    "question": "Constructor overloading is an example of which type of polymorphism?",
    "options": [
      "Compile-time (static) polymorphism",
      "Runtime (dynamic) polymorphism",
      "Subtyping polymorphism",
      "Parametric reflection"
    ],
    "correctAnswer": "Compile-time (static) polymorphism",
    "explanation": "Because the compiler decides which constructor to execute at compile-time based on the argument count and types, constructor overloading is compile-time polymorphism.",
    "hint": "Resolved by the compiler based on parameters before execution."
  },
  {
    "id": "oop-29",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "SOLID Principles",
    "title": "Open/Closed Principle (OCP)",
    "question": "What does the Open/Closed Principle (OCP) require software modules to be?",
    "options": [
      "Open for extension, but closed for modification",
      "Open for source code sharing, closed for binary execution",
      "Open for public inheritance, closed for composition",
      "Open for memory writes, closed for concurrent reads"
    ],
    "correctAnswer": "Open for extension, but closed for modification",
    "explanation": "OCP states that systems should be designed to allow adding new behavior without altering existing, tested source code (typically accomplished using polymorphism and interfaces).",
    "hint": "Extend behavior without modifying existing working code."
  },
  {
    "id": "oop-30",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Design Patterns",
    "title": "Template Method vs Strategy Pattern",
    "question": "How do the Template Method and Strategy patterns achieve behavioral customization differently?",
    "options": [
      "Template Method uses inheritance to let subclasses override algorithm steps; Strategy uses composition with delegated interface implementations",
      "Strategy requires static compilation; Template Method requires virtual bytecodes",
      "Template Method cannot have default steps",
      "Strategy can only be applied to mathematical computations"
    ],
    "correctAnswer": "Template Method uses inheritance to let subclasses override algorithm steps; Strategy uses composition with delegated interface implementations",
    "explanation": "Template Method defines an algorithm skeleton in a base class and lets subclasses override specific primitive operations. Strategy delegates the entire algorithm to a composed object.",
    "hint": "Template Method relies on subclassing; Strategy relies on object composition."
  },
  {
    "id": "oop-31",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Code Output",
    "title": "Non-Virtual Function Hiding in C++",
    "question": "What is printed by this code?\n```cpp\nclass Base {\npublic:\n    void show() { cout << \"Base\"; }\n};\nclass Derived : public Base {\npublic:\n    void show() { cout << \"Derived\"; }\n};\nint main() {\n    Base* ptr = new Derived();\n    ptr->show();\n}\n```",
    "options": [
      "Base",
      "Derived",
      "Compilation Error",
      "BaseDerived"
    ],
    "correctAnswer": "Base",
    "explanation": "Because `show()` is NOT declared `virtual`, static early binding applies. The compiler calls Base::show() because the pointer type is `Base*`.",
    "hint": "Without the virtual keyword, member calls are resolved by the pointer type, not the instance type."
  },
  {
    "id": "oop-32",
    "gameType": "oop-quiz",
    "difficulty": "EASY",
    "category": "Four Pillars",
    "title": "Copy Constructor",
    "question": "In C++, when is a copy constructor called automatically?",
    "options": [
      "When an object is passed by value to a function or initialized from another object of the same type",
      "When an object is passed by reference `&`",
      "Only when explicitly invoked via `malloc`",
      "When an object pointer is cast using `static_cast`"
    ],
    "correctAnswer": "When an object is passed by value to a function or initialized from another object of the same type",
    "explanation": "A copy constructor `ClassName(const ClassName&)` is invoked when creating a new object initialized from an existing one, passing by value, or returning by value (subject to copy elision/RVO).",
    "hint": "Called when passing or initializing objects by value."
  },
  {
    "id": "oop-33",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Memory Management",
    "title": "std::shared_ptr and Circular References",
    "question": "What problem arises when two objects hold `std::shared_ptr` references to each other in C++?",
    "options": [
      "A circular reference cycle where reference counts never drop to zero, causing a permanent memory leak",
      "A compile-time type mismatch error",
      "An immediate stack overflow during object construction",
      "The program terminates with an uncaught null pointer exception"
    ],
    "correctAnswer": "A circular reference cycle where reference counts never drop to zero, causing a permanent memory leak",
    "explanation": "Mutual strong references keep reference counts at >= 1 forever. Neither destructor is ever invoked, creating a memory leak. Breaking the cycle requires `std::weak_ptr`.",
    "hint": "Reference count never hits zero; use weak_ptr to break cyclic dependencies."
  },
  {
    "id": "oop-34",
    "gameType": "oop-quiz",
    "difficulty": "MEDIUM",
    "category": "Design Patterns",
    "title": "Composite Design Pattern",
    "question": "The Composite Pattern is designed to:",
    "options": [
      "Treat individual objects and compositions of objects (tree structures) uniformly through a common interface",
      "Assemble SQL query strings safely without injection risks",
      "Limit the number of objects created to save memory",
      "Convert procedural code to object-oriented classes"
    ],
    "correctAnswer": "Treat individual objects and compositions of objects (tree structures) uniformly through a common interface",
    "explanation": "Composite lets clients treat leaf nodes and complex container branches uniformly (e.g., File and Directory both implementing FileSystemItem with a getSize() method).",
    "hint": "Represents part-whole hierarchies and treats leaves and composites uniformly."
  },
  {
    "id": "oop-35",
    "gameType": "oop-quiz",
    "difficulty": "HARD",
    "category": "Polymorphism & Dispatch",
    "title": "Covariant Return Types",
    "question": "What are Covariant Return Types in object-oriented method overriding?",
    "options": [
      "An overriding method in a derived class can return a more derived pointer or reference type than the base method",
      "A method that accepts a variable number of generic arguments",
      "A function returning multiple values through a tuple",
      "A method whose return type changes based on compiler flags"
    ],
    "correctAnswer": "An overriding method in a derived class can return a more derived pointer or reference type than the base method",
    "explanation": "If Base::clone() returns `Base*`, Derived::clone() can override it and legally return `Derived*` because Derived* is narrower than Base*. This is called return type covariance.",
    "hint": "The overriding method returns a more specific subtype than the original method."
  }
];

export default oopQuestions;
