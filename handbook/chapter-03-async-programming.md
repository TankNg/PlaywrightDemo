# Chapter 3: Async Programming — The Event Loop, Promises, and async/await

---

## 1. Problem Introduction

You are writing your first Playwright test. You type:

```typescript
test('user can log in', ({ page }) => {
  page.goto('https://myapp.com/login');    // Missing await
  page.fill('#email', 'user@test.com');    // Missing await
  page.fill('#password', 'secret123');     // Missing await
  page.click('#submit');                   // Missing await
  expect(page).toHaveURL('/dashboard');    // Missing await
});
```

The test runs. It passes. You are confused — the page didn't actually load, nothing was filled, the button wasn't clicked. How did it pass?

Or worse: you add `await` in some places but not others, and the test gives you completely random, inconsistent results. Sometimes it passes, sometimes it fails, with no obvious reason.

Or you see this error and have no idea what it means:

```
Error: page.click: Target closed
```

All of these problems share a root cause: **you do not yet have a working mental model of asynchronous programming**.

This chapter exists to give you that model — completely, deeply, without shortcuts. Understanding async is not optional for Playwright engineers. It is the core skill. Every Playwright API call is asynchronous. Every test you write depends on this understanding.

---

## 2. Why Async Programming Exists — The Core Problem

Before diving into how async works, we need to feel the problem it solves.

### Analogy: A Restaurant Without Waitstaff Multitasking

Imagine a restaurant where the single waiter operates **synchronously**:

1. Takes order from Table 1
2. Goes to the kitchen and WAITS for food (does nothing else)
3. Brings food to Table 1
4. Takes order from Table 2
5. Goes to kitchen and WAITS...
6. Brings food to Table 2...

If Table 1's order takes 20 minutes to cook, Tables 2 through 20 wait. The waiter does nothing useful for 20 minutes. This is absurdly inefficient.

A real waiter operates **asynchronously**:

1. Takes order from Table 1
2. Gives order to kitchen
3. Goes to Table 2, takes order
4. Gives order to kitchen
5. Goes to Table 3...
6. Kitchen signals: Table 1's food is ready
7. Waiter picks it up, delivers to Table 1
8. Kitchen signals: Table 3's food is ready...

The waiter is never blocked — as soon as they hand off work (to the kitchen), they immediately go do the next thing. When the kitchen finishes, the waiter handles it.

This is exactly how Node.js works.

### The Concrete Scenario: Loading a Web Page

When Playwright navigates to a URL:

```typescript
await page.goto('https://myapp.com');
```

Internally, this involves:
1. Sending a network request to the server
2. Waiting for DNS resolution
3. Waiting for TCP connection
4. Waiting for the server to respond with HTML
5. Waiting for the browser to parse HTML
6. Waiting for additional resources (CSS, JavaScript) to load
7. Waiting for JavaScript to execute

All of this involves **waiting** — waiting for network, waiting for the browser engine, waiting for timers. During all this waiting, the CPU is doing almost nothing.

If Node.js blocked (like the bad waiter) during this waiting, it could not run any other code. If you were running 10 tests in parallel, you would need 10 separate CPU threads, each blocked.

Instead, Node.js uses **asynchronous I/O**: it kicks off the network request, registers a callback ("call me when the response arrives"), and immediately becomes available to do other things. When the browser signals it has finished loading, the callback runs and your code continues.

---

## 3. Mental Model: The Event Loop

The event loop is the heartbeat of Node.js. Understanding it deeply is essential for understanding why Playwright works the way it does.

### The Single Thread Reality

Here is a fact that surprises many people: **Node.js runs JavaScript on a single thread.**

There is literally one JavaScript execution thread. One. Your test code, Playwright's internal code, event handlers — all of it runs on the same thread, one thing at a time.

"But how does it handle multiple things simultaneously?" This is the key insight: it does not handle multiple things *simultaneously*. It handles one thing at a time, but it switches between them extremely fast, and it never blocks when waiting for I/O.

### The Event Loop: A Detailed Mental Model

Imagine the event loop as a single worker (the thread) managing a series of queues:

```
┌─────────────────────────────────────────────────────┐
│                 NODE.JS PROCESS                      │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Call Stack                       │   │
│  │  (currently executing JavaScript code)        │   │
│  │  ┌──────────────────────────────────────┐    │   │
│  │  │  test() function                      │    │   │
│  │  │  → page.goto() ...                   │    │   │
│  │  └──────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────┘   │
│                        ↑↓                            │
│  ┌─────────────────────────────────────────────┐    │
│  │              Event Queue                     │    │
│  │  (completed callbacks waiting to run)        │    │
│  │  [ navigated! ] [ element found! ] ...       │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │         Node.js / OS Background Work         │    │
│  │  (network I/O, file I/O, timers)             │    │
│  │  DNS resolving... TCP connecting...          │    │
│  │  Browser protocol messages...               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**The event loop algorithm (simplified):**

```
while (there is work to do) {
  1. If the call stack is empty:
     a. Check if any microtasks are queued (Promise callbacks)
     b. If yes, run ALL of them (until the microtask queue is empty)
  2. Take one item from the event queue
  3. Push it onto the call stack
  4. Execute it (until it yields, awaits, or returns)
  5. Repeat
}
```

The key insight: **JavaScript code runs to completion before the event loop can pick up the next item.** When your test function is running, nothing else can run. When it hits an `await`, it pauses and hands control back to the event loop.

### Execution Flow of `await page.goto()`

Let's trace exactly what happens step by step:

```typescript
test('login', async ({ page }) => {
  console.log('A: Before goto');
  await page.goto('/login');
  console.log('B: After goto');
  await page.click('#submit');
  console.log('C: After click');
});
```

**Execution trace:**

```
1. Test function starts
2. "A: Before goto" is logged
3. page.goto('/login') is CALLED
   - Playwright sends "navigate to /login" message to browser (async)
   - page.goto() returns a Promise (immediately, before navigation completes)
4. `await` sees the Promise
   - The current function is SUSPENDED
   - The Promise is registered: "when you resolve, resume this function"
   - Control returns to the event loop
5. Event loop: nothing else to do, waits...
6. [Background: Browser navigates to /login, HTML loads, JS executes...]
7. [Background: Playwright receives "navigation complete" signal from browser]
8. Event loop: navigation complete event arrives!
   - The Promise is resolved
   - The suspended function is queued to resume
9. Event loop picks it up
10. Function resumes after the `await`
11. "B: After goto" is logged
12. page.click('#submit') is CALLED...
[Repeat the same pattern for click]
```

This is fundamentally different from blocking code, where the function would never yield and nothing else could run.

---

## 4. Promises — The Foundation

Before `async/await` existed (they were introduced in ES2017), developers used **Promises** directly. Understanding Promises is essential because:
1. `async/await` is just syntactic sugar over Promises
2. Many Playwright APIs return Promises
3. Understanding Promises helps you debug async issues
4. Some advanced patterns require direct Promise manipulation

### What Is a Promise?

A Promise is an object that represents the **eventual result of an asynchronous operation**. Think of it like a receipt at a restaurant: when you order food, you receive a receipt immediately (the Promise), even though the food is not ready yet. The receipt represents "I promise you will get food eventually."

A Promise can be in one of three states:

```
┌──────────────────────────────────────────────────────┐
│                   PROMISE STATES                      │
│                                                        │
│   ┌──────────┐    success     ┌──────────────┐        │
│   │          │ ─────────────→ │   Fulfilled   │        │
│   │ Pending  │                │  (has value)  │        │
│   │          │ ─────────────→ │   Rejected    │        │
│   └──────────┘    failure     │  (has error)  │        │
│                               └──────────────┘        │
│                                                        │
│  Once settled (fulfilled or rejected), it never       │
│  changes state again.                                  │
└──────────────────────────────────────────────────────┘
```

### Creating Promises

```typescript
// Creating a Promise manually (you rarely do this — most libraries return Promises)
const myPromise = new Promise<string>((resolve, reject) => {
  // This function runs immediately (synchronously)
  
  setTimeout(() => {
    const success = Math.random() > 0.5;
    if (success) {
      resolve('Operation succeeded!');  // Fulfills the Promise with a value
    } else {
      reject(new Error('Operation failed!'));  // Rejects the Promise with an error
    }
  }, 1000);
  
  // After calling setTimeout, this function returns
  // The Promise is now 'pending', waiting for resolve or reject to be called
});
```

### Consuming Promises with `.then()` and `.catch()`

The original way to handle Promises (before async/await):

```typescript
page.goto('/login')
  .then(() => {
    // Runs when goto completes successfully
    return page.fill('#email', 'user@test.com');  // Returns another Promise
  })
  .then(() => {
    // Runs when fill completes
    return page.click('#submit');
  })
  .then(() => {
    console.log('All done!');
  })
  .catch((error) => {
    // Runs if ANY step in the chain fails
    console.error('Something failed:', error.message);
  })
  .finally(() => {
    // Runs no matter what — success or failure
    console.log('Test complete');
  });
```

This is called **Promise chaining**. Each `.then()` receives the resolved value of the previous Promise.

### The Problem With Promise Chains

Promise chains quickly become hard to read and reason about:

```typescript
// Promise chain — hard to follow
login(page)
  .then((isLoggedIn) => {
    if (isLoggedIn) {
      return navigate(page, '/dashboard');
    }
    return Promise.reject(new Error('Login failed'));
  })
  .then(() => {
    return page.waitForSelector('.dashboard-widget');
  })
  .then((widget) => {
    return widget.click();
  })
  .catch((error) => {
    // Where exactly did this error come from?
    // Was it login? navigation? waiting? clicking?
    console.error(error);
  });
```

This is why `async/await` was invented.

---

## 5. `async/await` — Promises with Readable Syntax

`async/await` is syntactic sugar over Promises. It makes asynchronous code **look and behave** like synchronous code — but it is still asynchronous under the hood.

### The `async` Keyword

When you add `async` before a function, two things happen:
1. The function always returns a Promise (even if you return a plain value)
2. You can use `await` inside it

```typescript
// Regular function — returns a string
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Async function — returns a Promise<string>
async function greetAsync(name: string): Promise<string> {
  return `Hello, ${name}!`;  // TypeScript wraps this in Promise.resolve()
}

// These are equivalent:
const greeting1 = greet('Alice');        // string: "Hello, Alice!"
const greeting2 = greetAsync('Alice');   // Promise<string> that resolves to "Hello, Alice!"
const greeting3 = await greetAsync('Alice');  // string: "Hello, Alice!"
```

### The `await` Keyword

`await` pauses an `async` function until a Promise settles:

```typescript
async function performLogin(page: Page): Promise<void> {
  // Equivalent to the Promise chain above, but readable
  await page.goto('/login');
  await page.fill('#email', 'user@test.com');
  await page.fill('#password', 'secret123');
  await page.click('#submit');
  await page.waitForURL('/dashboard');
}
```

You can read this almost like English: "Go to login page, then fill email, then fill password, then click submit, then wait for URL to change to dashboard."

**Critical rule:** `await` can only be used inside an `async` function. Using it outside causes a syntax error. This is why Playwright test bodies must always use `async ({ page }) => { ... }` — because the test function is async.

### What `await` Actually Does (The Mechanism)

```typescript
// This code:
const result = await someAsyncOperation();
doSomethingWith(result);

// Is roughly equivalent to:
someAsyncOperation().then((result) => {
  doSomethingWith(result);
});
```

But with `async/await`, the "callback" is the continuation of the current function — the code after the `await`. The JavaScript engine handles this transformation automatically. You write linear code; the engine converts it to the callback-based form.

### Error Handling with `async/await`

Promise rejection becomes a thrown exception that you can catch with `try/catch`:

```typescript
async function login(page: Page, email: string, password: string): Promise<void> {
  try {
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#submit');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Login failed for ${email}: ${error.message}`);
    }
    throw error;
  }
}
```

This is much more natural than `.catch()` on Promise chains. You can use all the familiar `try/catch/finally` patterns you know.

---

## 6. The Dangers of Missing `await` — The Most Common Playwright Bug

This is critical. Missing a single `await` can cause tests to appear to pass when they should fail, or fail for mysterious reasons.

### Scenario 1: Test Passes But Nothing Happened

```typescript
test('user can log in', async ({ page }) => {
  page.goto('/login');           // ❌ Missing await
  page.fill('#email', 'a@b.c'); // ❌ Missing await
  page.click('#submit');        // ❌ Missing await
  
  // What actually happens:
  // - All three lines run SYNCHRONOUSLY
  // - They each create a Promise and IMMEDIATELY return
  // - The test function completes before any of the browser operations begin
  // - The test "passes" because no error was thrown
  // - The browser probably hasn't even started loading the page yet
});
```

**This is dangerous:** you think you have a passing test but it is not testing anything.

### Scenario 2: Race Conditions

```typescript
test('form submission', async ({ page }) => {
  await page.goto('/form');
  page.fill('#name', 'John');     // ❌ Missing await — starts but doesn't wait
  await page.click('#submit');   // Submits BEFORE fill might complete!
  
  // Race condition: click might execute before fill finishes
  // Test might fail randomly depending on timing
});
```

### Scenario 3: The Deceptive `expect`

```typescript
test('navigation', async ({ page }) => {
  await page.click('#go-to-dashboard');
  expect(page).toHaveURL('/dashboard');  // ❌ Missing await
  
  // expect().toHaveURL() is an assertion that returns a Promise
  // Without await, the assertion creates a Promise but never waits for it
  // The test function exits, the assertion never runs
  // Test passes even if you are still on the wrong page!
});
```

### Scenario 4: Unhandled Promise Rejection

```typescript
test('broken test', async ({ page }) => {
  page.goto('https://nonexistent.domain.xyz');  // ❌ Missing await
  // No await = error is an "unhandled Promise rejection"
  // In some Node.js configurations, this crashes the process
  // In others, it silently swallows the error
  
  // The test might pass because the error was never propagated
});
```

### The Rule: Always Await Playwright Methods

**Every Playwright method that returns a Promise must be awaited.** The Playwright documentation consistently uses `await` on every operation. When you see example code without `await`, it is either a bug in the documentation or the method genuinely returns synchronously (rare in Playwright).

**How to check if a method returns a Promise:** Hover over it in your IDE. TypeScript will show the return type. If it is `Promise<something>`, it must be awaited.

```typescript
// Playwright methods that MUST be awaited
await page.goto(url);
await page.click(selector);
await page.fill(selector, text);
await page.selectOption(selector, value);
await page.waitForSelector(selector);
await expect(page).toHaveURL(url);
await expect(locator).toBeVisible();

// Playwright methods that do NOT need await (synchronous)
const locator = page.locator('#email');  // Returns Locator, not Promise
const url = page.url();                  // Returns string, not Promise
const title = await page.title();        // Returns Promise<string> — needs await
```

---

## 7. Common Async Patterns in Playwright

### Pattern 1: Sequential Operations

The most common pattern — do things one after another:

```typescript
async function checkout(page: Page, product: Product, user: User): Promise<void> {
  await page.goto('/shop');
  await page.click(`[data-product-id="${product.id}"]`);
  await page.click('#add-to-cart');
  await page.goto('/cart');
  await page.click('#checkout');
  await page.fill('#email', user.email);
  await page.fill('#card-number', user.card.number);
  await page.click('#place-order');
  await page.waitForURL('/confirmation');
}
```

### Pattern 2: Parallel Operations

When operations are independent, run them simultaneously:

```typescript
// Sequential — takes sum of all times
const title = await page.title();         // 100ms
const url = await page.url();             // synchronous, 0ms
const element = await page.waitForSelector('.main-content'); // 500ms
// Total: ~600ms

// Parallel — takes max of all times
const [title, element] = await Promise.all([
  page.title(),
  page.waitForSelector('.main-content')
]);
// Total: ~500ms (runs simultaneously)
```

**When to use `Promise.all`:**
- Operations are completely independent
- No operation depends on the result of another
- Performance matters (parallel is faster)

**When NOT to use `Promise.all`:**
- Operations must happen in order (fill form, then submit)
- Operations depend on each other's results

### Pattern 3: `Promise.allSettled` for Non-Failing Parallel Work

```typescript
// Promise.all FAILS if any Promise rejects
// Use Promise.allSettled when you want ALL results, even if some fail
const results = await Promise.allSettled([
  page.waitForSelector('.optional-widget'),
  page.waitForSelector('.required-widget'),
  page.waitForSelector('.maybe-widget'),
]);

results.forEach((result) => {
  if (result.status === 'fulfilled') {
    console.log('Found:', result.value);
  } else {
    console.log('Not found:', result.reason);
  }
});
```

### Pattern 4: `Promise.race` for Timeouts and Alternatives

```typescript
// First to complete wins — useful for "wait for X or Y, whichever comes first"
async function waitForLoginOrError(page: Page): Promise<'success' | 'error'> {
  const result = await Promise.race([
    page.waitForURL('/dashboard').then(() => 'success' as const),
    page.waitForSelector('.error-message').then(() => 'error' as const),
  ]);
  return result;
}
```

### Pattern 5: Implementing Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        console.log(`Attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;  // Exponential backoff
      }
    }
  }
  
  throw new Error(`All ${maxAttempts} attempts failed. Last error: ${lastError?.message}`);
}

// Usage
const user = await withRetry(() => apiClient.createUser(userData));
```

### Pattern 6: Async IIFE (Immediately Invoked Function Expression)

Sometimes you need async in a context that does not support it:

```typescript
// In playwright.config.ts — top-level async
(async () => {
  const config = await loadConfig();
  module.exports = defineConfig({ ... });
})();

// Or using top-level await (requires "module": "ESNext")
const config = await loadConfig();
```

---

## 8. Microtasks vs Macrotasks — The Deeper Event Loop

For advanced debugging, you need to understand that the event queue is actually split into priority queues.

```
Event Loop Iteration:
  
  1. Call Stack empties
  2. Run ALL microtasks (Promise callbacks, queueMicrotask)
     - These run immediately, back-to-back, before anything else
  3. Run ONE macrotask (setTimeout, setInterval, I/O callbacks)
  4. Run ALL resulting microtasks from that macrotask
  5. Check for I/O events, timers, etc.
  6. Repeat
```

### Microtasks (High Priority)
- Promise `.then()` / `.catch()` / `.finally()` callbacks
- `async` function resumptions after `await`
- `queueMicrotask()`

### Macrotasks (Normal Priority)
- `setTimeout()` callbacks
- `setInterval()` callbacks
- I/O callbacks (network responses, file reads)
- `setImmediate()` (Node.js specific)

### Why This Matters for Playwright

When Playwright receives a signal from the browser (a navigation completed, an element appeared, a network request finished), that signal arrives as a macrotask. But Promise continuations are microtasks.

This means:

```typescript
await page.goto('/login');
// When this resolves:
// 1. The browser sent "navigation complete" (macrotask)
// 2. Playwright's internal Promise resolved
// 3. Your await continuation scheduled as microtask
// 4. Microtask runs: your code after the await executes
// Everything happens in a predictable, ordered way
```

This ordering is why Playwright's operations are reliable and ordered even though they seem to run "concurrently."

---

## 9. Async Iteration and `for await...of`

When you need to process a stream of values asynchronously:

```typescript
// AsyncIterable — produces values asynchronously
async function* generateTestUsers(count: number): AsyncGenerator<User> {
  for (let i = 0; i < count; i++) {
    const user = await createTestUser(i);  // API call
    yield user;  // Pause and provide value
  }
}

// Consuming with for await...of
for await (const user of generateTestUsers(10)) {
  await runUserTest(user);
}
// Processes each user sequentially, waiting for each API call
```

### Processing Paginated API Results

```typescript
async function* fetchAllUsers(): AsyncGenerator<User[]> {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await apiClient.getUsers({ page, limit: 50 });
    yield response.data;
    hasMore = response.hasNextPage;
    page++;
  }
}

// In a test — verify all users appear in the UI
for await (const userBatch of fetchAllUsers()) {
  for (const user of userBatch) {
    await expect(page.locator(`[data-user-id="${user.id}"]`)).toBeVisible();
  }
}
```

---

## 10. Real-World Async Pattern: The Playwright `waitForResponse` Pattern

One of the most powerful Playwright async patterns: waiting for a network response while performing a UI action that triggers it.

**The problem:** You click a button, which triggers an API call. You want to wait for that API call to complete, then verify the result. How do you time it correctly?

```typescript
// ❌ Anti-pattern — race condition
await page.click('#save-button');
// What if the response arrives before we start waiting?
const response = await page.waitForResponse('/api/save');
// You might miss the response if the network is fast!

// ✅ Correct — start waiting BEFORE the action that triggers the response
const responsePromise = page.waitForResponse('/api/save');
await page.click('#save-button');           // Triggers the API call
const response = await responsePromise;    // Now wait for it

// Parse the response
const data = await response.json();
expect(data.success).toBe(true);
```

This pattern works because:
1. `page.waitForResponse()` sets up a listener immediately, returning a Promise
2. `await page.click()` triggers the network request
3. `await responsePromise` waits for the listener to capture the response

The listener is in place *before* the click, so it cannot miss the response regardless of network speed.

This same pattern applies to `page.waitForRequest()`, `page.waitForNavigation()`, and `page.waitForURL()`.

---

## 11. Async Anti-Patterns in Playwright

### Anti-Pattern 1: The Callback Pyramid (Callback Hell)

```typescript
// ❌ Nested callbacks — hard to read and maintain
page.goto('/login', () => {
  page.fill('#email', 'test@test.com', () => {
    page.fill('#password', 'secret', () => {
      page.click('#submit', () => {
        // Three levels deep and growing
      });
    });
  });
});

// ✅ Flat async/await
await page.goto('/login');
await page.fill('#email', 'test@test.com');
await page.fill('#password', 'secret');
await page.click('#submit');
```

Note: Playwright's API does not use callbacks (it uses Promises), but this pattern shows up when developers try to write Playwright code without understanding async.

### Anti-Pattern 2: `Promise` Ignored in a Loop

```typescript
// ❌ Fire-and-forget in a loop — none of these are awaited
const selectors = ['#a', '#b', '#c', '#d'];
selectors.forEach(async (selector) => {
  await page.click(selector);  // await is inside an async callback
  // BUT the forEach itself doesn't await the callbacks!
  // All four clicks are fired without any waiting between them
});

// ✅ Sequential — one at a time
for (const selector of selectors) {
  await page.click(selector);  // Waits for each click before the next
}

// ✅ Parallel — all at once, wait for all
await Promise.all(selectors.map(selector => page.click(selector)));
```

The `forEach` with `async` pattern is one of the most common bugs in JavaScript async code. `forEach` does not understand Promises — it starts each callback but does not wait for them to complete.

### Anti-Pattern 3: Sequential When Parallel Is Possible

```typescript
// ❌ Sequential API calls that are independent — slow
const user = await apiClient.getUser(userId);     // 200ms
const products = await apiClient.getProducts();   // 300ms
const config = await apiClient.getConfig();       // 100ms
// Total: 600ms

// ✅ Parallel — faster
const [user, products, config] = await Promise.all([
  apiClient.getUser(userId),
  apiClient.getProducts(),
  apiClient.getConfig()
]);
// Total: ~300ms (the slowest one)
```

### Anti-Pattern 4: Sleeping Instead of Waiting

```typescript
// ❌ Hard-coded sleep — fragile and slow
await page.click('#submit');
await page.waitForTimeout(3000);  // Wait 3 seconds... hoping the page loads
await expect(page.locator('.success')).toBeVisible();

// ✅ Wait for the actual condition
await page.click('#submit');
await expect(page.locator('.success')).toBeVisible();  
// Playwright waits automatically, up to the configured timeout
// Faster when the element appears early, reliable when it appears late
```

`page.waitForTimeout()` has its place (rate limiting, animation timing), but it should never be used as a substitute for proper waiting. We cover Playwright's auto-waiting in depth in Chapter 5.

### Anti-Pattern 5: Unhandled Promise Rejections

```typescript
// ❌ Fire-and-forget with potential rejection
async function cleanupTestData(): Promise<void> {
  apiClient.deleteUser(testUserId);    // Not awaited!
  apiClient.deleteProduct(testProductId);  // Not awaited!
}

// If these fail, the errors are silently swallowed
// Your test passes but the data is not cleaned up

// ✅ Always await or handle
async function cleanupTestData(): Promise<void> {
  await Promise.allSettled([
    apiClient.deleteUser(testUserId),
    apiClient.deleteProduct(testProductId),
  ]);
}
```

---

## 12. The Playwright Async Contract — What Playwright Guarantees

Understanding Playwright's async contract helps you write reliable tests.

### All Browser Operations Are Serialized Per Context

Within a single browser context, all operations are serialized — Playwright sends one command at a time to the browser and waits for acknowledgment. Even `Promise.all` with multiple page operations doesn't send them in parallel to the *same* page — Playwright queues them.

```typescript
// This looks parallel but is serialized on the browser side (same page)
await Promise.all([
  page.fill('#email', 'test@test.com'),
  page.fill('#password', 'secret')
]);
// Playwright queues these and sends them one by one to the browser
```

### Multiple Contexts Can Run Truly in Parallel

```typescript
// Two separate browser contexts run truly in parallel
const [context1, context2] = await Promise.all([
  browser.newContext(),
  browser.newContext()
]);

const [page1, page2] = await Promise.all([
  context1.newPage(),
  context2.newPage()
]);

// These navigate simultaneously in separate contexts
await Promise.all([
  page1.goto('/user-view'),
  page2.goto('/admin-view'),
]);
```

This is used in tests that verify multi-user scenarios — for example, one user sends a message while another user verifies they received it.

---

## 13. Common Debugging Scenarios

### Debugging: Test Completes Too Fast

**Symptom:** Test finishes in under 1 second. Operations that should take time appear instantaneous.

**Diagnosis:** Missing `await` on critical operations. The test function completes before Playwright operations run.

**Fix:** Search for Promise-returning Playwright calls that lack `await`. Look for:
```typescript
// These are ALL missing await:
page.goto(url);
page.click(selector);
page.fill(selector, text);
expect(locator).toBeVisible();
```

### Debugging: "Target closed" Error

```
Error: page.click: Target closed
```

**Meaning:** The page was closed (or the browser context was torn down) while you were trying to interact with it.

**Common cause:** A test teardown (the `afterEach` hook) closed the page before an unresolved Promise resolved.

**Diagnosis:** Look for missing `await` that allows the test to "complete" before cleanup should happen, but an unawaited Promise resolves after cleanup.

### Debugging: Intermittent Failures With No Pattern

**Symptom:** The test passes 80% of the time, fails 20% of the time, with no obvious reason.

**Diagnosis:** Race condition. Usually one of:
- Missing `await` causing operations to overlap
- `waitForResponse` set up after the triggering action (missed the response)
- `page.waitForSelector` timing out because the page is not in the right state

**General approach:**
```typescript
// Add trace collection to capture what actually happened
await page.context().tracing.start({ screenshots: true, snapshots: true });
// ... test code ...
await page.context().tracing.stop({ path: 'trace.zip' });
// View with: npx playwright show-trace trace.zip
```

The trace viewer shows every operation with timestamps, network requests, and DOM snapshots — making race conditions immediately visible.

---

## 14. Enterprise Perspective: Async at Scale

### Parallel Test Execution

Playwright runs tests in parallel by default. Understanding async is essential for safe parallelization:

**Shared state = race conditions:**
```typescript
// ❌ Dangerous — multiple parallel tests sharing state
let globalTestUser: User;

test.beforeAll(async () => {
  globalTestUser = await createUser();  // Created once
});

test('test 1', async ({ page }) => {
  await loginAs(page, globalTestUser);
  await page.click('#delete-account');  // Deletes the shared user!
  // Now test 2 fails because the user is gone
});

test('test 2', async ({ page }) => {
  await loginAs(page, globalTestUser);  // User was deleted by test 1!
});
```

**Isolated state = safe parallelism:**
```typescript
// ✅ Each test creates its own user
test('test 1', async ({ page }) => {
  const user = await createUser();         // Test-specific user
  await loginAs(page, user);
  await page.click('#delete-account');
  await deleteUser(user);                  // Clean up
});

test('test 2', async ({ page }) => {
  const user = await createUser();         // Different test-specific user
  await loginAs(page, user);
  // Independent of test 1
});
```

### Async Resource Management

In enterprise frameworks, test data and resources must be cleaned up reliably, even when tests fail:

```typescript
test('complex workflow', async ({ page }) => {
  const testUser = await apiClient.createUser(generateUserData());
  const testProduct = await apiClient.createProduct(generateProductData());
  
  try {
    await loginAs(page, testUser);
    await addToCart(page, testProduct);
    await checkout(page, testUser.paymentMethod);
    await expect(page.locator('.order-confirmation')).toBeVisible();
  } finally {
    // ALWAYS clean up — even if the test fails
    await Promise.allSettled([
      apiClient.deleteUser(testUser.id),
      apiClient.deleteProduct(testProduct.id),
    ]);
  }
});
```

The `finally` block runs regardless of success or failure, ensuring test data is cleaned up. `Promise.allSettled` ensures both cleanups run even if one fails.

In Chapter 6 (Fixtures), we will see how Playwright's fixture system provides a more elegant way to manage this using teardown callbacks.

---

## 15. Summary

Async programming is the foundation of everything in Playwright. Here is the distilled understanding:

### Core Mental Models

**The event loop** runs JavaScript on a single thread, never blocking. When code hits an `await`, it yields control back to the event loop, which picks up other work (I/O callbacks, timers) until the awaited Promise resolves.

**A Promise** is an object representing an eventual value. It is either pending, fulfilled (with a value), or rejected (with an error). Once settled, it never changes.

**`async/await`** is syntactic sugar over Promises. `async` makes a function return a Promise. `await` pauses the function until a Promise settles, then resumes with the resolved value (or throws the rejection reason).

**Missing `await` is a silent bug factory.** Every Playwright API call that returns a Promise MUST be awaited. No exceptions.

### The Async Toolbox

| Tool | When to Use |
|------|-------------|
| `await` | Single async operation that must complete before proceeding |
| `Promise.all([...])` | Multiple independent operations, need all results |
| `Promise.allSettled([...])` | Multiple operations, need all results even if some fail |
| `Promise.race([...])` | First operation to complete wins |
| `try/catch/finally` | Error handling and cleanup |
| `for await...of` | Processing async iterables or streams |
| `waitForResponse` before `click` | Capturing network responses triggered by UI actions |

### What Comes Next

You now understand the JavaScript runtime and how asynchronous code actually executes. In the next chapter, we turn from language fundamentals to the tool itself: **Playwright Architecture**. We will understand how Playwright controls browsers, why the browser/context/page hierarchy exists, and how this design makes scalable automation possible.

---

*Next: Chapter 4 — Playwright Architecture: Browsers, Contexts, Pages, and the Protocol*
