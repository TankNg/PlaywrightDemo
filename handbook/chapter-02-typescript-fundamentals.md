# Chapter 2: TypeScript Fundamentals — Types, Interfaces, and the Compilation Pipeline

---

## 1. Problem Introduction

You have just joined an automation team that has been writing tests in JavaScript for two years. The codebase is 15,000 lines. You open a test file and find this:

```javascript
async function fillCheckoutForm(page, user, options) {
  await page.fill('#email', user.email);
  await page.fill('#name', user.firstName + ' ' + user.lastName);
  if (options.express) {
    await page.click('#express-checkout');
  }
  await page.selectOption('#country', user.address.country);
}
```

You want to call this function. Questions immediately pile up:

- What shape does `user` need to have? Does it need `firstName` or `first_name`? Is `lastName` one word?
- What properties does `options` have? Are there other options besides `express`?
- What happens if `user.address` is null? Will it crash?
- Is `user.email` expected to be a string? What if someone passes a number?

You have to hunt through the codebase to find how this function is called elsewhere, read through test data files, hope the documentation exists. This is called **implicit knowledge** — information that lives in developers' heads rather than in the code itself.

Now imagine the codebase is 50,000 lines, there are 12 contributors, and the original author left the company. This is the world JavaScript automation frameworks live in.

TypeScript was built to solve this problem.

---

## 2. Why TypeScript Exists

TypeScript is a programming language created by Microsoft and released in 2012. It is a **strict syntactic superset of JavaScript** — meaning all valid JavaScript is valid TypeScript, but TypeScript adds features on top.

The single most important feature TypeScript adds is a **static type system**.

### What Is a Type System?

A type system is a mechanism that assigns a **type** to every piece of data in a program. The type describes what kind of value it is and what operations are valid on it.

Examples of types:
- `string` — a piece of text: `"hello"`, `"user@email.com"`
- `number` — a numeric value: `42`, `3.14`
- `boolean` — true or false
- `string[]` — an array of strings
- `{ name: string; age: number }` — an object with specific properties

**A static type system** checks types at **compile time** — before the code runs. If you make a type error (passing a number where a string is expected, accessing a property that doesn't exist), TypeScript tells you *immediately* — in your editor, before you even run the tests.

**A dynamic type system** (like JavaScript) checks types at **runtime** — while the code is executing. Errors only appear when the code runs, often at 2 AM in production.

### The Concrete Problem TypeScript Solves

Let's revisit the `fillCheckoutForm` function, this time in TypeScript:

```typescript
interface Address {
  street: string;
  city: string;
  country: string;
  postalCode: string;
}

interface User {
  email: string;
  firstName: string;
  lastName: string;
  address: Address;
}

interface CheckoutOptions {
  express: boolean;
  giftWrap?: boolean;  // Optional — the ? means it might not be present
}

async function fillCheckoutForm(
  page: Page, 
  user: User, 
  options: CheckoutOptions
): Promise<void> {
  await page.fill('#email', user.email);
  await page.fill('#name', user.firstName + ' ' + user.lastName);
  if (options.express) {
    await page.click('#express-checkout');
  }
  await page.selectOption('#country', user.address.country);
}
```

Now, when you use this function:

```typescript
// TypeScript immediately tells you about the error in your editor:
await fillCheckoutForm(page, {
  email: 'test@test.com',
  firstName: 'John',
  // lastName missing! ← TypeScript error: Property 'lastName' is missing
}, { express: true });
```

No need to read documentation. No need to find other usages. No need to run the test and watch it fail. TypeScript catches the mistake in milliseconds, in your editor, with a precise error message.

### TypeScript vs JavaScript: The Key Difference

```
JavaScript:
  Write code → Run code → Discover errors at runtime

TypeScript:
  Write code → TypeScript checks types → Errors in editor → Fix → Run code
```

TypeScript adds a **feedback loop** that happens before execution. For automation engineering, this is invaluable because:

1. Tests are often run infrequently (not after every line of code)
2. Test failures can take minutes to surface
3. Automation frameworks grow large and complex
4. Multiple engineers contribute to the same codebase
5. Page Object Models accumulate complex method signatures

---

## 3. Mental Model: TypeScript is a Linter That Understands Your Intent

The best mental model for TypeScript is this: **TypeScript is an extremely intelligent linter that understands the shape and contract of your code.**

When you write:

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

You are making a **contract**: "This function takes a string and returns a string." TypeScript enforces that contract everywhere `greet` is called. If you call `greet(42)`, TypeScript says: "You promised to pass a string. 42 is a number. Contract violated."

This is fundamentally different from writing comments like `// name should be a string`. Comments are ignored by machines. Type annotations are checked by machines.

### TypeScript Does Not Run Your Code

This is a critical mental model. TypeScript is a **compiler**, not a runtime. It:

1. Reads your `.ts` files
2. Checks types and reports errors
3. **Erases all type information**
4. Outputs plain `.js` files
5. The `.js` files are what Node.js actually runs

```
Your TypeScript code:
  function greet(name: string): string { ... }
                        ↓
TypeScript compiler (tsc)
                        ↓
Output JavaScript:
  function greet(name) { ... }  // Types erased!
```

Types exist only during the development/compilation phase. At runtime, it is plain JavaScript. This means:
- TypeScript cannot catch runtime errors (network failures, null values from APIs)
- Types you define are not validated at runtime unless you explicitly write validation code
- The performance of your tests is identical to JavaScript — there is no TypeScript overhead at runtime

---

## 4. Internal Mechanics: The TypeScript Compilation Pipeline

Understanding what happens when TypeScript compiles your code is important for debugging and configuration.

### The Pipeline

```
.ts source files
       ↓
  TypeScript Compiler (tsc)
       ↓
  ┌────────────────────────┐
  │  1. Parsing            │  → Creates AST (Abstract Syntax Tree)
  │  2. Type Checking      │  → Reports errors
  │  3. Transformation     │  → Applies transforms
  │  4. Emit               │  → Outputs .js files
  └────────────────────────┘
       ↓
  .js output files
  .d.ts declaration files (optional)
  .js.map source map files (optional)
```

**Parsing:** TypeScript reads your source code character by character and builds an **Abstract Syntax Tree** — a tree representation of your code's structure. `function greet(name: string)` becomes a tree node of type "FunctionDeclaration" with child nodes for parameters.

**Type Checking:** TypeScript traverses the AST, infers types, checks your annotations, and reports errors. This is where `tsc` says "hey, you passed a number where a string was expected."

**Emit:** TypeScript strips type annotations and outputs JavaScript. This output is controlled by `tsconfig.json`.

### `tsconfig.json` — The Compiler Configuration

Every TypeScript project needs a `tsconfig.json`. This file controls how TypeScript compiles your code.

```json
{
  "compilerOptions": {
    // --- Output ---
    "target": "ES2020",          // What JS version to output
    "module": "commonjs",        // Module system for output
    "outDir": "./dist",          // Where to put compiled files
    "rootDir": "./",             // Root of source files
    
    // --- Type Checking Strictness ---
    "strict": true,              // Enable ALL strict checks
    "noImplicitAny": true,       // Error on implicit 'any' type
    "strictNullChecks": true,    // null and undefined are not assignable to other types
    "strictFunctionTypes": true, // Stricter checking on function types
    
    // --- Module Resolution ---
    "moduleResolution": "node",  // How to resolve imports
    "esModuleInterop": true,     // Better compatibility with CommonJS modules
    "skipLibCheck": true,        // Skip checking .d.ts files in node_modules
    
    // --- Path Aliases ---
    "baseUrl": ".",
    "paths": {
      "@pages/*": ["./pages/*"],
      "@utils/*": ["./utils/*"],
      "@fixtures/*": ["./fixtures/*"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Let's understand the critical options:

### `target`

Controls what JavaScript version TypeScript outputs. JavaScript features that don't exist in the target are **downleveled** (compiled to equivalent older code).

```typescript
// Your TypeScript (uses ES2020 optional chaining)
const city = user?.address?.city;

// Output if target: "ES5"
var city = user === null || user === void 0 
  ? void 0 
  : (_a = user.address) === null || _a === void 0 
  ? void 0 
  : _a.city;

// Output if target: "ES2020" (native support, no transformation)
const city = user?.address?.city;
```

For Playwright tests, `"ES2020"` or newer is recommended. Modern Node.js supports it natively, so no downleveling is needed.

### `strict: true`

This is the most important setting. It enables a bundle of strict checks:

| Check | What it prevents |
|-------|-----------------|
| `strictNullChecks` | Accessing properties on potentially null/undefined values |
| `noImplicitAny` | Using a variable that TypeScript can't infer a type for |
| `strictFunctionTypes` | Assigning functions with incompatible signatures |
| `strictPropertyInitialization` | Class properties declared but never assigned |

**Always use `"strict": true`** in new projects. The short-term cost of fixing errors is heavily outweighed by the long-term benefit of catching real bugs.

### `skipLibCheck: true`

This skips type checking of `.d.ts` files in `node_modules/`. Without this, TypeScript would type-check all third-party libraries, which is slow and sometimes causes false errors if libraries have imperfect type definitions. Always include this for performance.

### Path Aliases

```json
"paths": {
  "@pages/*": ["./pages/*"],
  "@utils/*": ["./utils/*"]
}
```

Path aliases allow you to import using clean paths instead of relative paths:

```typescript
// Without path alias — messy relative paths
import { LoginPage } from '../../../pages/auth/login-page';

// With path alias — clean
import { LoginPage } from '@pages/auth/login-page';
```

**Important:** Path aliases in `tsconfig.json` are understood by TypeScript (for type checking), but Node.js does not understand them at runtime. You need either:
- A build step (compile to JavaScript first)
- `ts-node` with `tsconfig-paths` plugin
- Playwright handles this automatically for test files

For Playwright projects, the test runner compiles TypeScript internally, so path aliases work if configured correctly. We will address this in detail in the framework chapters.

---

## 5. Core TypeScript Types — The Building Blocks

### Primitive Types

```typescript
// Strings
const email: string = 'user@example.com';
const message: string = `Hello, ${email}`;

// Numbers
const timeout: number = 5000;
const ratio: number = 0.8;

// Booleans
const isLoggedIn: boolean = true;
const headless: boolean = false;

// null and undefined
const maybeNull: null = null;
const notYetSet: undefined = undefined;

// Symbol (rarely used in testing)
const id: symbol = Symbol('uniqueId');

// BigInt (for very large numbers)
const bigNumber: bigint = 9007199254740993n;
```

### Type Inference — TypeScript Reads Your Code

A common beginner mistake: annotating types on everything. TypeScript is smart enough to **infer** types from context. You do not need to write `: string` when the value is clearly a string.

```typescript
// TypeScript infers these types — no annotation needed
const email = 'user@example.com';     // TypeScript knows: string
const timeout = 5000;                  // TypeScript knows: number
const isLoggedIn = true;              // TypeScript knows: boolean

// This is redundant — TypeScript already knows it's a string
const email: string = 'user@example.com';  // Unnecessary annotation
```

**Rule of thumb:** Only annotate types when TypeScript cannot infer them — function parameters, complex objects, and situations where you want to be explicit for documentation purposes.

```typescript
// TypeScript cannot infer parameter types — annotation required
function waitForElement(selector: string, timeout: number): Promise<void> {
  // ...
}

// TypeScript infers the return type from the function body
function formatName(first: string, last: string) {
  return `${first} ${last}`;  // TypeScript infers: string
}
```

### Arrays

```typescript
// Array of strings
const selectors: string[] = ['#email', '#password', '#submit'];

// Alternative syntax (less common)
const selectors2: Array<string> = ['#email', '#password'];

// Array of numbers
const retryDelays: number[] = [1000, 2000, 4000];

// Array of mixed types (tuple — fixed length, specific types)
const credentials: [string, string] = ['user@test.com', 'password123'];
//                  [email,  password]
```

### Objects and Interfaces

In TypeScript, you describe the shape of objects using either **interfaces** or **type aliases**. These are the tools you will use constantly in automation frameworks.

**Interface:**
```typescript
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';  // Union type — one of these specific strings
  address?: Address;  // Optional — may or may not be present
}
```

**Type alias:**
```typescript
type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
};
```

Both define the same thing — an object shape. The differences are subtle:

| Feature | `interface` | `type` |
|---------|-------------|--------|
| Extends other types | `interface B extends A` | `type B = A & { ... }` |
| Merging (declaration merging) | ✅ Can be reopened | ❌ Cannot |
| Computed property names | ❌ | ✅ |
| Union types | ❌ | ✅ |
| Primitive aliases | ❌ | ✅ |

**Convention for automation frameworks:** Use `interface` for object shapes (Users, Products, Configuration). Use `type` for unions, intersections, and aliases of primitives.

```typescript
// interfaces for object shapes
interface LoginCredentials {
  email: string;
  password: string;
}

interface ProductDetails {
  name: string;
  price: number;
  inStock: boolean;
}

// type for unions and aliases
type Browser = 'chromium' | 'firefox' | 'webkit';
type Timeout = number;  // alias for documentation clarity
type TestEnvironment = 'local' | 'staging' | 'production';
```

### Optional Properties (`?`)

```typescript
interface SearchOptions {
  query: string;
  maxResults?: number;     // Optional — if not provided, use defaults
  filterByDate?: boolean;  // Optional
  sortBy?: 'relevance' | 'date' | 'price';  // Optional union
}

// All of these are valid:
const options1: SearchOptions = { query: 'playwright' };
const options2: SearchOptions = { query: 'playwright', maxResults: 10 };
const options3: SearchOptions = { 
  query: 'playwright', 
  maxResults: 10, 
  sortBy: 'date' 
};
```

### Readonly Properties

```typescript
interface PageConfig {
  readonly baseURL: string;  // Cannot be changed after initialization
  timeout: number;           // Can be changed
}

const config: PageConfig = {
  baseURL: 'https://myapp.com',
  timeout: 30000,
};

config.timeout = 60000;   // ✅ OK
config.baseURL = 'other'; // ❌ Error: Cannot assign to 'baseURL' because it is a read-only property
```

Use `readonly` for configuration values that should not change after initialization.

---

## 6. Union Types and Type Narrowing

Union types allow a value to be one of several types:

```typescript
type StringOrNumber = string | number;

function formatValue(value: string | number): string {
  // At this point, TypeScript knows value is string | number
  // You can't call string methods because it might be a number
  
  if (typeof value === 'string') {
    // Here, TypeScript NARROWS the type to: string
    return value.toUpperCase();  // Safe — value is definitely a string
  }
  
  // Here, TypeScript NARROWS the type to: number
  return value.toFixed(2);  // Safe — value is definitely a number
}
```

**Type narrowing** is TypeScript's ability to make the type more specific inside conditional branches based on your checks. This is a powerful feature.

### Narrowing Techniques

**`typeof` narrowing:**
```typescript
function processInput(input: string | number | boolean) {
  if (typeof input === 'string') {
    // input: string
    return input.trim();
  } else if (typeof input === 'number') {
    // input: number
    return input * 2;
  } else {
    // input: boolean
    return !input;
  }
}
```

**Null/undefined narrowing:**
```typescript
interface Config {
  timeout?: number;  // Optional
}

function getTimeout(config: Config): number {
  if (config.timeout !== undefined) {
    // config.timeout: number (not undefined)
    return config.timeout;
  }
  return 30000;  // Default
}

// Shorter version with nullish coalescing
function getTimeout2(config: Config): number {
  return config.timeout ?? 30000;  // Use config.timeout if defined, else 30000
}
```

**`instanceof` narrowing:**
```typescript
function handleError(error: Error | string): string {
  if (error instanceof Error) {
    // error: Error
    return error.message;
  }
  // error: string
  return error;
}
```

**Discriminated unions** — the most powerful pattern for automation frameworks:

```typescript
// A discriminated union uses a shared "discriminant" property
type TestResult = 
  | { status: 'passed'; duration: number }
  | { status: 'failed'; duration: number; errorMessage: string }
  | { status: 'skipped'; reason: string };

function reportResult(result: TestResult): string {
  switch (result.status) {
    case 'passed':
      // result: { status: 'passed'; duration: number }
      return `✓ Passed in ${result.duration}ms`;
    case 'failed':
      // result: { status: 'failed'; duration: number; errorMessage: string }
      return `✗ Failed: ${result.errorMessage} (${result.duration}ms)`;
    case 'skipped':
      // result: { status: 'skipped'; reason: string }
      return `⊘ Skipped: ${result.reason}`;
  }
}
```

TypeScript's switch-case exhaustiveness checking means that if you add a new `status` to the union later and forget to handle it in the `switch`, TypeScript will warn you.

---

## 7. Generics — Writing Reusable Typed Code

Generics are one of the most powerful TypeScript features. They allow you to write code that works with **any type** while still being type-safe.

### The Problem Without Generics

```typescript
// Without generics — you'd need separate functions for each type
function getFirstString(arr: string[]): string {
  return arr[0];
}

function getFirstNumber(arr: number[]): number {
  return arr[0];
}

// This works but is duplicated and inflexible
```

### The Solution: Generics

```typescript
// With generics — one function works for any type
function getFirst<T>(arr: T[]): T {
  return arr[0];
}

// TypeScript infers T from usage
const firstEmail = getFirst(['a@test.com', 'b@test.com']);  // T = string
const firstTimeout = getFirst([1000, 2000, 3000]);           // T = number
```

`<T>` is a **type parameter** — a placeholder for a type that is filled in when the function is called. Think of it like a parameter for types, the same way function parameters are placeholders for values.

### Real-World Generic: API Response Wrapper

In automation frameworks, you often call APIs and need to wrap responses in a consistent structure:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  timestamp: string;
}

interface User {
  id: number;
  email: string;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

// These functions return different data types, but the same wrapper structure
async function getUser(id: number): Promise<ApiResponse<User>> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

async function getProduct(id: number): Promise<ApiResponse<Product>> {
  const response = await fetch(`/api/products/${id}`);
  return response.json();
}

// Usage — TypeScript knows the exact shape of data
const userResponse = await getUser(1);
console.log(userResponse.data.email);   // TypeScript knows: string
console.log(userResponse.data.price);  // ❌ Error: 'price' doesn't exist on User!
```

### Generic Constraints

You can constrain what types `T` can be:

```typescript
// T must have an 'id' property that is a number or string
function findById<T extends { id: number | string }>(
  items: T[], 
  id: number | string
): T | undefined {
  return items.find(item => item.id === id);
}

// Works for any object that has an 'id'
const user = findById(users, 1);
const product = findById(products, 'prod-123');
```

---

## 8. Classes in TypeScript

Classes are fundamental to the Page Object Model pattern. TypeScript adds important features to JavaScript classes.

### Basic Class Structure

```typescript
class LoginPage {
  // Properties with types
  private readonly page: Page;
  private readonly emailInput = '#email';
  private readonly passwordInput = '#password';
  private readonly submitButton = '#login-button';
  
  // Constructor
  constructor(page: Page) {
    this.page = page;
  }
  
  // Methods
  async navigate(): Promise<void> {
    await this.page.goto('/login');
  }
  
  async fillEmail(email: string): Promise<void> {
    await this.page.fill(this.emailInput, email);
  }
  
  async fillPassword(password: string): Promise<void> {
    await this.page.fill(this.passwordInput, password);
  }
  
  async submit(): Promise<void> {
    await this.page.click(this.submitButton);
  }
  
  async login(email: string, password: string): Promise<void> {
    await this.navigate();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }
}
```

### Access Modifiers

TypeScript adds access control to class members:

| Modifier | Accessible From |
|----------|----------------|
| `public` (default) | Anywhere |
| `private` | Only inside the class |
| `protected` | Inside the class and subclasses |
| `readonly` | Can be read anywhere (based on other modifiers), but not reassigned |

```typescript
class BasePage {
  protected page: Page;         // Subclasses can access this
  private secret: string = '';  // Only this class can access
  public readonly url: string;  // Everyone can read, no one can write

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
  }
}

class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, '/login');
  }
  
  async navigate(): Promise<void> {
    await this.page.goto(this.url);  // ✅ Can access protected 'page' and public 'url'
    // this.secret  // ❌ Error: 'secret' is private to BasePage
  }
}
```

### Constructor Parameter Shorthand

TypeScript offers a shorthand to declare and assign properties directly in the constructor:

```typescript
// Long form — declare then assign
class LoginPage {
  private page: Page;
  private config: TestConfig;
  
  constructor(page: Page, config: TestConfig) {
    this.page = page;
    this.config = config;
  }
}

// Shorthand — TypeScript generates the above automatically
class LoginPage {
  constructor(
    private page: Page,
    private config: TestConfig
  ) {}
  // 'page' and 'config' are automatically declared as private properties
}
```

The shorthand is idiomatic TypeScript and widely used in Page Object Models.

### Inheritance — Extending Classes

```typescript
abstract class BasePage {
  constructor(protected page: Page) {}
  
  // Abstract method — subclasses MUST implement this
  abstract navigate(): Promise<void>;
  
  // Concrete method — subclasses can use or override
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
  
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}

class LoginPage extends BasePage {
  private readonly emailSelector = '#email';
  private readonly passwordSelector = '#password';
  
  // Must implement the abstract method
  async navigate(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForPageLoad();  // Can use inherited method
  }
  
  async login(email: string, password: string): Promise<void> {
    await this.navigate();
    await this.page.fill(this.emailSelector, email);
    await this.page.fill(this.passwordSelector, password);
    await this.page.click('#submit');
  }
}
```

**`abstract` classes** cannot be instantiated directly — they can only be extended. They are perfect for `BasePage` patterns where you want to define a common interface but require subclasses to implement the specifics.

---

## 9. Enums and Literal Types

### Enums

Enums define a named set of constants:

```typescript
enum Environment {
  Local = 'local',
  Staging = 'staging',
  Production = 'production'
}

enum Browser {
  Chromium = 'chromium',
  Firefox = 'firefox',
  WebKit = 'webkit'
}

// Usage
const currentEnv: Environment = Environment.Staging;
const browser: Browser = Browser.Chromium;

function getBaseURL(env: Environment): string {
  switch (env) {
    case Environment.Local:
      return 'http://localhost:3000';
    case Environment.Staging:
      return 'https://staging.myapp.com';
    case Environment.Production:
      return 'https://myapp.com';
  }
}
```

### String Literal Types — Often Better Than Enums

For many use cases, a union of string literals is cleaner than an enum:

```typescript
// Enum approach
enum TestStatus {
  Passed = 'passed',
  Failed = 'failed',
  Skipped = 'skipped'
}

// String literal union — equivalent but simpler
type TestStatus = 'passed' | 'failed' | 'skipped';

// Usage is slightly cleaner
const status: TestStatus = 'passed';     // vs TestStatus.Passed
```

The advantage of string literal unions: the values are just strings. The advantage of enums: they are namespaced (you can see `TestStatus.Passed` in code and know it's a status). Choose based on whether namespacing matters in your context.

**A strong convention:** In Playwright projects, use string literal types for simple flags and states, use `const` objects (covered next) for complex groups:

```typescript
// Better than enum for this use case
const BROWSER = {
  CHROMIUM: 'chromium',
  FIREFOX: 'firefox',
  WEBKIT: 'webkit',
} as const;

type Browser = typeof BROWSER[keyof typeof BROWSER];
// Browser = 'chromium' | 'firefox' | 'webkit'
```

---

## 10. TypeScript Utility Types — Tools Built Into TypeScript

TypeScript comes with powerful built-in utility types for transforming types. These are invaluable in large codebases.

### `Partial<T>` — All Properties Optional

```typescript
interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

// When updating a profile, you might only change some fields
async function updateProfile(
  userId: number, 
  updates: Partial<UserProfile>  // All fields optional
): Promise<void> {
  // Can update just email, or just name, or any combination
}

// Usage — only specifying what changes
await updateProfile(1, { email: 'newemail@test.com' });
await updateProfile(1, { firstName: 'Jane', lastName: 'Doe' });
```

### `Required<T>` — All Properties Required

The opposite of `Partial` — makes all optional properties required:

```typescript
interface SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

// In some contexts, all filters must be provided
type FullSearchFilters = Required<SearchFilters>;
// { query: string; category: string; minPrice: number; maxPrice: number }
```

### `Pick<T, K>` — Select Specific Properties

```typescript
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;  // Never send to client!
  createdAt: Date;
}

// Public-safe user object — never includes passwordHash
type PublicUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
```

### `Omit<T, K>` — Exclude Specific Properties

```typescript
// Equivalent to the above, but expressed differently
type PublicUser = Omit<User, 'passwordHash' | 'createdAt'>;
```

### `Record<K, V>` — Dictionary Type

```typescript
// A map from selector name to CSS selector string
type SelectorMap = Record<string, string>;

const selectors: SelectorMap = {
  emailInput: '#email',
  passwordInput: '#password',
  submitButton: '#login-btn',
};

// More specific: keys are a union of known selectors
type CheckoutSelectors = Record<
  'emailInput' | 'addressLine1' | 'cityInput' | 'submitButton',
  string
>;
```

### Real-World Utility Type Composition

```typescript
interface TestUser {
  id: number;
  email: string;
  password: string;
  role: 'admin' | 'user';
  firstName: string;
  lastName: string;
}

// For creating new users — no id (assigned by server)
type CreateUserPayload = Omit<TestUser, 'id'>;

// For login — only need credentials
type LoginCredentials = Pick<TestUser, 'email' | 'password'>;

// For UI display — no sensitive data
type DisplayUser = Omit<TestUser, 'password'>;

// For partial updates
type UserUpdate = Partial<Omit<TestUser, 'id' | 'email'>>;
```

---

## 11. Type Assertions and the `as` Keyword

Sometimes you know more about a type than TypeScript does. Type assertions let you override TypeScript's inference:

```typescript
// TypeScript infers: HTMLElement | null
const element = document.querySelector('#submit');

// You know it's specifically a button — assertion
const button = document.querySelector('#submit') as HTMLButtonElement;
button.disabled = true;  // Safe to access button-specific properties
```

### When Type Assertions Are Dangerous

```typescript
// ❌ Dangerous — lying to TypeScript
const user = {} as User;  // TypeScript believes you, but user has no properties
user.email;  // Undefined at runtime — TypeScript was lied to
```

### The Safe Alternative: Type Guards

Instead of asserting, write code that actually verifies the type:

```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'email' in value &&
    'firstName' in value &&
    typeof (value as any).email === 'string'
  );
}

// Usage
const data = await fetchFromAPI();
if (isUser(data)) {
  // data: User — TypeScript now knows for certain
  console.log(data.email);
}
```

**Rule:** Use type assertions sparingly and only when you are certain. Prefer type guards for runtime validation. Never use type assertions to silence TypeScript on values that genuinely might not match the expected type.

---

## 12. Working with `unknown` and `any`

### `any` — The Escape Hatch (Use Rarely)

`any` disables TypeScript's type checking for a value:

```typescript
let value: any = 'hello';
value = 42;           // OK
value = { complex: 'object' };  // OK
value.nonExistent();  // OK for TypeScript — but will throw at runtime!
```

`any` is useful when:
- Migrating JavaScript code to TypeScript incrementally
- Working with truly dynamic data from external sources
- As a very temporary workaround

**Never use `any` in production automation frameworks.** It undermines the entire purpose of TypeScript. Every `any` is a gap in your safety net.

### `unknown` — The Safe Alternative

`unknown` also accepts any value, but you must narrow it before using it:

```typescript
function parseApiResponse(response: unknown): User {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Response is not an object');
  }
  
  if (!('email' in response)) {
    throw new Error('Response missing email field');
  }
  
  // After validation, safe to assert
  return response as User;
}
```

`unknown` is the correct type for data coming from APIs, file reads, or any source you do not control. It forces you to validate before using.

---

## 13. `async/await` Types — Promise Typing

Since Playwright is entirely asynchronous, you must understand how TypeScript types async operations.

### The `Promise<T>` Type

A function that returns a Promise that will resolve to type `T` has return type `Promise<T>`:

```typescript
// Returns a Promise that resolves to a string
async function getPageTitle(page: Page): Promise<string> {
  return await page.title();
}

// Returns a Promise that resolves to void (no return value)
async function clickButton(page: Page, selector: string): Promise<void> {
  await page.click(selector);
}

// Returns a Promise that resolves to User or null
async function findUser(email: string): Promise<User | null> {
  const response = await fetch(`/api/users?email=${email}`);
  if (response.status === 404) return null;
  return response.json();
}
```

### Awaiting Multiple Promises

```typescript
// Sequential — each waits for the previous to complete
const title = await page.title();
const url = await page.url();

// Parallel — both run simultaneously, wait for both
const [title, url] = await Promise.all([
  page.title(),
  page.url()
]);
// TypeScript correctly infers: [string, string]
```

### Error Handling in Async Functions

```typescript
async function login(page: Page, credentials: LoginCredentials): Promise<void> {
  try {
    await page.goto('/login');
    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);
    await page.click('#submit');
    
    // Wait for navigation after login
    await page.waitForURL('/dashboard', { timeout: 10000 });
  } catch (error) {
    // error type is: unknown (TypeScript 4.0+)
    if (error instanceof Error) {
      throw new Error(`Login failed: ${error.message}`);
    }
    throw error;
  }
}
```

In TypeScript 4.0+, caught errors in `catch` blocks have type `unknown` (not `any`). This is safer — it forces you to check what kind of error you caught before accessing `.message` or other properties.

---

## 14. Type Declarations and `.d.ts` Files

When TypeScript compiles your code, it can output `.d.ts` (declaration) files alongside the `.js` files. These files contain type information without any actual code — they are purely for TypeScript's benefit.

When you use `@playwright/test`, TypeScript uses the `.d.ts` files that ship with that package to understand what types `Page`, `Locator`, `expect`, etc. are. You never write these files manually when consuming packages.

You will write them manually when creating shared utility libraries or when adding types to JavaScript files in a mixed project.

```typescript
// utils.d.ts — type declarations for utils.js
export declare function formatDate(date: Date): string;
export declare function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T>;
export declare interface RetryOptions {
  attempts: number;
  delay: number;
}
```

### `@types/` Packages

Some JavaScript libraries do not include TypeScript declarations. The community maintains type definitions in the `@types/` scope on npm:

```bash
npm install --save-dev @types/node
```

`@types/node` provides TypeScript types for Node.js built-in modules (like `fs`, `path`, `process`). You need this for any Playwright project.

When you install a package:
1. If it includes `.d.ts` files — TypeScript uses them automatically
2. If it doesn't — check if `@types/package-name` exists and install it
3. If neither — you can write your own declarations or use `any`

---

## 15. Common Mistakes

### Mistake 1: Ignoring TypeScript Errors

```typescript
// ❌ Anti-pattern: TypeScript error suppression
// @ts-ignore
await page.click(undefined);

// ❌ Anti-pattern: Casting to any to silence errors
await page.click(undefined as any);

// ✅ Correct: Fix the actual problem
const selector = await getSelector();
if (!selector) throw new Error('Selector not found');
await page.click(selector);
```

TypeScript errors are information. When you suppress them, you are hiding a real issue. Every `@ts-ignore` and `as any` in a codebase is technical debt that will manifest as a runtime bug eventually.

### Mistake 2: Overusing `any` During Migration

When migrating a JavaScript project to TypeScript:

```typescript
// ❌ Quick but creates debt
function processData(data: any): any { ... }

// ✅ Start with unknown, progressively narrow
function processData(data: unknown): ProcessedResult {
  if (!isValidData(data)) throw new Error('Invalid data');
  // Now use data safely
}
```

### Mistake 3: Not Using `strict: true`

```json
// ❌ Missing strict mode — TypeScript catches fewer errors
{
  "compilerOptions": {
    "target": "ES2020"
  }
}

// ✅ Always enable strict mode
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true
  }
}
```

### Mistake 4: Type Assertions Where Guards Are Needed

```typescript
// ❌ Type assertion — assumes, doesn't verify
const user = apiResponse as User;
console.log(user.email);  // Could crash if apiResponse is not a User

// ✅ Type guard — verifies at runtime
function parseUser(data: unknown): User {
  if (!isUser(data)) throw new Error(`Expected User, got: ${JSON.stringify(data)}`);
  return data;
}
```

### Mistake 5: Annotating Things TypeScript Can Already Infer

```typescript
// ❌ Redundant annotations — TypeScript already knows
const timeout: number = 5000;
const message: string = 'Hello';
const active: boolean = true;
const names: string[] = ['Alice', 'Bob'];

// ✅ Let inference work
const timeout = 5000;
const message = 'Hello';
const active = true;
const names = ['Alice', 'Bob'];

// ✅ Only annotate when inference can't help
function createUser(data: unknown): User { ... }  // Unknown params need annotation
```

---

## 16. Anti-Patterns

### Anti-Pattern 1: The `any` Sandwich

```typescript
// ❌ Using any to pass data between functions — all type safety lost
function processApiData(rawData: any): any {
  const normalized: any = normalizeData(rawData);
  const validated: any = validateData(normalized);
  return validated;
}

// ✅ Typed throughout
function processApiData(rawData: unknown): ValidatedUser {
  const normalized = normalizeData(rawData);  // returns NormalizedData
  const validated = validateData(normalized);  // returns ValidatedUser
  return validated;
}
```

### Anti-Pattern 2: Parallel Type Hierarchies

```typescript
// ❌ Anti-pattern: Maintaining two representations of the same thing
interface ApiUser {
  user_id: number;
  user_email: string;
}

interface AppUser {
  userId: number;
  userEmail: string;
}

// Now you need to manually convert between them everywhere

// ✅ Better: One canonical type with a transformation function
interface User {
  id: number;
  email: string;
}

function fromApiUser(apiUser: ApiUser): User {
  return { id: apiUser.user_id, email: apiUser.user_email };
}
```

### Anti-Pattern 3: God Interface

```typescript
// ❌ Anti-pattern: One interface with everything
interface TestContext {
  page: Page;
  user: User;
  adminUser: User;
  apiClient: ApiClient;
  database: Database;
  emailService: EmailService;
  reportHelper: ReportHelper;
  // ... 20 more properties
}

// ✅ Composed interfaces
interface AuthContext {
  user: User;
  token: string;
}

interface PageContext {
  page: Page;
  baseURL: string;
}

interface ApiContext {
  apiClient: ApiClient;
}
```

### Anti-Pattern 4: Ignoring Compiler Errors in CI

TypeScript errors should break the CI build. Configure this in your pipeline:

```json
// package.json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "ci": "npm run typecheck && npm run lint && npm run test"
  }
}
```

`--noEmit` runs the TypeScript compiler for type checking without producing output files — fast and perfect for CI validation.

---

## 17. Enterprise Perspective

### TypeScript Configuration Standards

Enterprise teams standardize TypeScript configuration across projects using a shared `tsconfig.base.json`:

```json
// @company/tsconfig-base/tsconfig.json (published as internal package)
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Project `tsconfig.json`:
```json
{
  "extends": "@company/tsconfig-base",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./"
  }
}
```

This ensures all projects have consistent strictness without copy-pasting configuration.

### Type Coverage Metrics

Enterprise teams track **type coverage** — the percentage of code that has proper types (not `any`):

```bash
# Using type-coverage package
npm install --save-dev type-coverage
npx type-coverage --min-percentage 90
```

Setting a minimum threshold (90%+ is excellent) prevents gradual erosion of type safety as the codebase grows.

### Using `noUncheckedIndexedAccess`

This stricter option (not included in `strict: true`) makes array/object indexing safer:

```typescript
// Without noUncheckedIndexedAccess
const arr = ['a', 'b', 'c'];
const first: string = arr[0];  // TypeScript assumes arr[0] is always string

// With noUncheckedIndexedAccess
const arr = ['a', 'b', 'c'];
const first: string | undefined = arr[0];  // TypeScript acknowledges it might be undefined
// Forces you to handle the undefined case
const value = arr[0] ?? 'default';
```

For automation frameworks that index into test data arrays, this prevents subtle "Cannot read properties of undefined" runtime errors.

---

## 18. Debugging TypeScript

### Understanding TypeScript Error Messages

TypeScript error messages can be long and nested. Reading them takes practice.

```
Type '{ email: string; }' is not assignable to type 'User'.
  Type '{ email: string; }' is missing the following properties 
  from type 'User': firstName, lastName, role
```

Read TypeScript errors from the **bottom up** — the specific, actionable message is usually at the end of the error chain.

### `tsc --noEmit` for Type Checking

```bash
# Type check only — don't output files
npx tsc --noEmit

# Type check with detailed error output
npx tsc --noEmit --pretty

# Watch mode — type check on every file save
npx tsc --noEmit --watch
```

### Using `as const` to Narrow Literal Types

```typescript
// Without as const — TypeScript infers wide types
const config = {
  browser: 'chromium',    // type: string (wide)
  headless: true,          // type: boolean (wide)
  timeout: 30000           // type: number (wide)
};

// With as const — TypeScript infers narrow literal types
const config = {
  browser: 'chromium',    // type: 'chromium' (literal)
  headless: true,          // type: true (literal)
  timeout: 30000           // type: 30000 (literal)
} as const;
```

`as const` is particularly useful when you define configuration objects that you want TypeScript to treat as fixed values.

---

## 19. Summary

TypeScript transforms automation engineering from an art into a discipline. Here is what you should carry forward:

### Core Mental Models

**TypeScript is a compile-time safety net**, not a runtime guardrail. It catches mistakes *before* your tests run, saving hours of debugging and false failures.

**Types are contracts.** When you annotate a function parameter as `string`, you are making a promise: "I will always pass a string here." TypeScript enforces that promise across your entire codebase.

**Inference is your friend.** Do not annotate everything — let TypeScript infer where it can. Annotate where it cannot: function parameters, return types of complex functions, and class properties.

**`strict: true` always.** The short-term pain of fixing type errors is eliminated by long-term bug prevention.

### The TypeScript Toolbox for Automation Engineers

You will use these constantly:
- **`interface`** — describe object shapes (User, Config, Page Data)
- **`type`** — unions, intersections, and type aliases
- **`generic <T>`** — reusable typed utilities (API wrappers, retry functions)
- **`class`** — Page Objects and framework components
- **`Partial<T>`, `Pick<T>`, `Omit<T>`** — transform existing types
- **`Promise<T>`** — type async operations
- **`unknown`** — safe typing for external data

### What Comes Next

With the Node.js ecosystem and TypeScript fundamentals in place, we are ready to tackle the most misunderstood concept in modern JavaScript development: **asynchronous programming**.

In Chapter 3, we will build a complete mental model of the JavaScript event loop, understand Promises from first principles, and master `async/await` — the tools that make Playwright's browser control possible.

---

*Next: Chapter 3 — Async Programming: The Event Loop, Promises, and async/await*
