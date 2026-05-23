# Chapter 4: Playwright Architecture — Browsers, Contexts, Pages, and the Protocol

---

## 1. Problem Introduction

You open a Playwright test and see this:

```typescript
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://myapp.com');
```

Three objects, three levels. Why not just:

```typescript
const page = await playwright.openPage('https://myapp.com');
```

Why does Playwright need `browser`, `context`, AND `page`? What is the difference between a browser and a context? When would you ever need two contexts? Why can't you just use the same page for everything?

These are not cosmetic API design questions. The three-layer hierarchy reflects a precise model of how modern browsers work, what isolation means, and how scalable parallel test execution is made possible.

This chapter answers all of it — from the communication protocol that makes Playwright work, through the browser architecture it mirrors, to the practical patterns you will use every day.

---

## 2. How Playwright Actually Works — The Protocol

To understand the architecture, you first need to understand *how* Playwright talks to browsers.

### Selenium's Approach: The HTTP Driver

In Selenium (which you may be migrating from), the communication model is:

```
Your Test Code
     ↓  HTTP requests
WebDriver Server (chromedriver / geckodriver)
     ↓  Browser-internal protocol
Browser
```

Selenium sends HTTP requests to a local WebDriver server (like `chromedriver`). That server translates them into browser commands. This is slow (HTTP round-trip overhead per command), fragile (WebDriver version must match browser version), and limited by what the HTTP API exposes.

### Playwright's Approach: WebSocket + Chrome DevTools Protocol

Playwright uses a fundamentally different approach:

```
Your Test Code
     ↓  WebSocket (persistent connection)
Playwright Node.js Library
     ↓  CDP / WebKit protocol / Firefox protocol
Browser Engine (directly)
```

**Chrome DevTools Protocol (CDP)** is the same protocol used by Chrome DevTools — the developer tools panel you open with F12. It is a rich, low-level protocol that exposes everything: DOM manipulation, network interception, JavaScript execution, performance metrics, page screenshots, and more.

Playwright communicates with browsers over a persistent WebSocket connection using these protocols. This means:

1. **No round-trip overhead:** WebSocket is persistent — no new connection per command
2. **Rich capabilities:** CDP exposes browser internals that WebDriver does not
3. **No driver version matching:** Playwright downloads its own browser binaries, ensuring compatibility
4. **Bidirectional communication:** The browser can proactively push events to Playwright (new request, console message, page crash)

### The Communication Flow

When you write:
```typescript
await page.click('#submit');
```

The actual execution path is:

```
1. page.click('#submit') called in your test code
   ↓
2. Playwright serializes this into a CDP message:
   { method: "Runtime.evaluate", params: { expression: "..." } }
   or uses DOM.querySelector + Input.dispatchMouseEvent
   ↓
3. Message sent over WebSocket to the browser
   ↓
4. Browser's CDP listener receives the message
   ↓
5. Browser finds the element, dispatches click events
   ↓
6. Browser sends success/failure response over WebSocket
   ↓
7. Playwright's Promise resolves
   ↓
8. Your await resumes
```

This is why Playwright operations are asynchronous — they involve real network communication (even if the "network" is local WebSocket communication to a browser on the same machine).

### How Playwright Supports Multiple Browsers

Playwright supports Chromium, Firefox, and WebKit (Safari's engine). Each uses a different native protocol:

- **Chromium:** Chrome DevTools Protocol (CDP)
- **Firefox:** Firefox Remote Debugging Protocol (similar to CDP)
- **WebKit:** WebKit Inspector Protocol

Playwright implements adapters for each protocol, presenting a single unified API to your test code. When you call `page.click()`, Playwright internally translates it to the appropriate protocol for the current browser.

This is a significant engineering achievement — the same test code runs on three completely different browser engines through three different protocols, abstracted behind one API.

---

## 3. The Browser-Context-Page Hierarchy

Now we can understand the three-layer hierarchy with precision.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│   (one running Chrome / Firefox / WebKit process)               │
│                                                                   │
│   ┌───────────────────────┐   ┌───────────────────────┐         │
│   │      CONTEXT A        │   │      CONTEXT B        │         │
│   │  (incognito session)  │   │  (incognito session)  │         │
│   │  - own cookies        │   │  - own cookies        │         │
│   │  - own localStorage   │   │  - own localStorage   │         │
│   │  - own permissions    │   │  - own permissions    │         │
│   │                       │   │                       │         │
│   │  ┌────┐ ┌────┐ ┌────┐│   │  ┌────┐ ┌────┐       │         │
│   │  │Page│ │Page│ │Page││   │  │Page│ │Page│        │         │
│   │  │  1 │ │  2 │ │  3 ││   │  │  1 │ │  2 │        │         │
│   │  └────┘ └────┘ └────┘│   │  └────┘ └────┘        │         │
│   └───────────────────────┘   └───────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: The Browser

The `Browser` object represents a single running browser process. When you call `chromium.launch()`, Playwright starts a new browser process (a real Chrome process on your machine) and returns a `Browser` object connected to it.

```typescript
const browser = await chromium.launch({
  headless: true,     // Run without visible window (default in CI)
  slowMo: 100,        // Slow down operations by 100ms (useful for debugging)
  args: ['--disable-web-security'],  // Pass arguments to the browser process
});
```

Key browser facts:
- One browser process can contain many contexts (similar to Chrome profiles)
- The browser itself is not the unit of isolation — the **context** is
- In most tests, you never interact with the `Browser` object directly — Playwright's test runner manages it

### Layer 2: The Browser Context

This is the most important layer to understand.

A browser context is an **isolated browser session** — similar to an incognito window in Chrome. Each context has completely separate:

- **Cookies** — logging in Context A does not affect Context B
- **localStorage / sessionStorage** — data stored by one context is invisible to another
- **Service workers** — isolated per context
- **IndexedDB** — isolated per context  
- **Permissions** — Context A can have camera permission, Context B cannot
- **HTTP authentication** — different credentials per context
- **Cache** — separate cache per context

This is how Playwright enables **true test isolation** and **parallel test execution**.

```typescript
// Two independent authenticated sessions
const adminContext = await browser.newContext({
  storageState: 'admin-auth.json',   // Pre-authenticated as admin
});
const userContext = await browser.newContext({
  storageState: 'user-auth.json',    // Pre-authenticated as regular user
});

const adminPage = await adminContext.newPage();
const userPage = await userContext.newPage();

// These pages are completely isolated — different sessions, different auth
await adminPage.goto('/admin-panel');
await userPage.goto('/user-dashboard');

// What happens in adminPage has zero effect on userPage
```

**The browser context is like a separate browser profile.** If Chrome profiles are familiar to you (one profile for work, one for personal), each Playwright browser context is equivalent to a fresh browser profile — completely isolated from every other profile.

### Layer 3: The Page

A page represents a single **browser tab**. It has a URL, a DOM, JavaScript context, and handles rendering.

```typescript
const page = await context.newPage();
```

Multiple pages can exist within one context, and they **share** the context's session state:

```typescript
const context = await browser.newContext();
const page1 = await context.newPage();
const page2 = await context.newPage();

// Login on page1
await page1.goto('/login');
await page1.fill('#email', 'user@test.com');
await page1.fill('#password', 'secret');
await page1.click('#submit');

// page2 shares the same session — already logged in!
await page2.goto('/dashboard');  // Works! Uses page1's session
```

This mirrors real browser behavior: tabs in the same Chrome window share cookies and session state.

---

## 4. The Playwright Test Runner — Fixtures and Contexts

When you use `@playwright/test` (the test runner), you don't usually manage browsers and contexts manually. The test runner provides them through **fixtures**.

```typescript
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  // 'page' is provided automatically by the test runner
  // Behind the scenes:
  //   1. Test runner launched a browser (or reuses existing)
  //   2. Test runner created a new context for THIS test
  //   3. Test runner created a page in that context
  //   4. Provided the page to your test function
  //   5. After test: closes the page, context
  
  await page.goto('/dashboard');
});
```

### The Default Isolation Model

By default, Playwright creates a **new browser context for each test**. This means:

```
Test 1 runs:
  - Context A created (fresh, no session)
  - Page opened
  - Test 1 executes
  - Context A destroyed (cookies, localStorage cleared)

Test 2 runs:
  - Context B created (fresh, no session)
  - Page opened
  - Test 2 executes
  - Context B destroyed
```

This isolation is the default and the recommended approach. Tests are completely independent — what one test does cannot affect another.

**This is fundamentally different from Selenium's typical approach**, where many teams share a single browser session across tests to avoid slow login steps. That approach causes test interdependency — if Test 3 fails, it might leave the browser in a state that causes Test 4 to fail. With Playwright's context isolation, each test starts completely fresh.

### Configuring Context Options

In `playwright.config.ts`, you configure defaults applied to every context:

```typescript
export default defineConfig({
  use: {
    // Context-level options
    baseURL: 'https://myapp.com',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Navigation options
    navigationTimeout: 30000,  // Timeout for page.goto()
    
    // Action options
    actionTimeout: 10000,      // Timeout for click, fill, etc.
    
    // Recording options
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  }
});
```

These defaults can be overridden per test using `test.use()`:

```typescript
test.describe('Mobile tests', () => {
  test.use({ viewport: { width: 390, height: 844 } });  // iPhone 14 Pro
  
  test('mobile checkout', async ({ page }) => {
    // page is in a mobile-sized viewport
  });
});
```

---

## 5. Browser Context Deep Dive — Configuration and Capabilities

### Storage State — The Pre-Authentication Pattern

The most powerful pattern for handling authentication efficiently:

**The Problem:** If every test needs to log in, and login takes 5 seconds, 100 tests waste 500 seconds on login alone.

**The Solution:** Log in once, save the session state, reuse it in every test.

```typescript
// Step 1: auth.setup.ts — run once before all tests
import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate as regular user', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', process.env.TEST_USER_EMAIL!);
  await page.fill('#password', process.env.TEST_USER_PASSWORD!);
  await page.click('#submit');
  await page.waitForURL('/dashboard');
  
  // Save the entire browser storage state (cookies, localStorage, etc.)
  await page.context().storageState({ path: authFile });
});
```

```typescript
// playwright.config.ts — configure test projects
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'logged-in tests',
      use: {
        storageState: 'playwright/.auth/user.json',  // Load saved auth
      },
      dependencies: ['setup'],  // Run setup first
    },
  ],
});
```

```typescript
// Any test in 'logged-in tests' project
test('dashboard loads', async ({ page }) => {
  // Already authenticated! No login needed.
  await page.goto('/dashboard');
  await expect(page.locator('.welcome-message')).toBeVisible();
});
```

The storage state includes all cookies (session cookies, auth tokens stored as cookies), localStorage values, and sessionStorage values. When loaded, the browser context is initialized with exactly the same state as after a real login — from the browser's perspective, the user is already logged in.

### Context Permissions

```typescript
const context = await browser.newContext({
  permissions: ['geolocation', 'notifications', 'clipboard-read'],
  geolocation: { latitude: 40.7128, longitude: -74.0060 },  // New York
  colorScheme: 'dark',
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});
```

This allows testing permission-dependent features:
- Location-based services
- Push notifications
- Camera/microphone access
- Clipboard operations

### HTTP Authentication

```typescript
const context = await browser.newContext({
  httpCredentials: {
    username: 'staging-user',
    password: 'staging-password',
  },
});
// Every HTTP request from this context includes Basic Auth headers
```

### Context Event Listeners

Contexts emit events you can listen to for monitoring and debugging:

```typescript
// Log all console messages from all pages in this context
context.on('page', (page) => {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[Browser Console Error] ${message.text()}`);
    }
  });
});

// Capture all network requests
context.on('request', (request) => {
  console.log(`→ ${request.method()} ${request.url()}`);
});

context.on('response', (response) => {
  if (response.status() >= 400) {
    console.error(`← ${response.status()} ${response.url()}`);
  }
});
```

---

## 6. The Page Object — Your Window to the Browser

The `Page` object is the primary interface you use in tests. It represents a browser tab and provides hundreds of methods for interacting with it.

### Page Lifecycle Events

```typescript
// Waiting for specific page states
await page.waitForLoadState('load');         // HTML loaded
await page.waitForLoadState('domcontentloaded');  // DOM ready
await page.waitForLoadState('networkidle');  // No pending network requests

// Navigation
await page.goto('/dashboard', { waitUntil: 'networkidle' });
await page.goBack();
await page.goForward();
await page.reload();
```

### Page-Level Events

```typescript
// Listening to page events
page.on('dialog', async (dialog) => {
  console.log(`Dialog: ${dialog.message()}`);
  await dialog.accept();  // or dialog.dismiss()
});

page.on('download', async (download) => {
  await download.saveAs('/tmp/downloaded-file');
});

page.on('popup', async (popup) => {
  // popup is a new Page object for the opened window
  await popup.waitForLoadState();
  console.log('Popup URL:', popup.url());
});

page.on('crash', () => {
  console.error('Page crashed!');
});
```

### Evaluating JavaScript in the Page

One of Playwright's most powerful features — running JavaScript directly in the browser page:

```typescript
// Execute JavaScript in browser context
const title = await page.evaluate(() => document.title);

// Pass data from Node.js to browser
const elementCount = await page.evaluate((selector) => {
  return document.querySelectorAll(selector).length;
}, '.list-item');

// Return complex objects
const userInfo = await page.evaluate(() => ({
  username: localStorage.getItem('username'),
  token: sessionStorage.getItem('auth-token'),
  cookies: document.cookie,
}));

// Modify the page directly
await page.evaluate(() => {
  localStorage.setItem('feature-flag', 'enabled');
  window.scrollTo(0, document.body.scrollHeight);
});
```

### Exposing Node.js Functions to the Browser

```typescript
// Make a Node.js function callable from browser JavaScript
await page.exposeFunction('readTestData', async (filename: string) => {
  const data = await fs.readFile(`test-data/${filename}`, 'utf-8');
  return JSON.parse(data);
});

// Now browser-side JavaScript can call readTestData()
await page.evaluate(async () => {
  const users = await window.readTestData('users.json');
  // Use users in browser context
});
```

---

## 7. Playwright vs Selenium: An Architectural Comparison

Understanding the differences helps you make better decisions and avoid bringing Selenium habits into Playwright code.

### Communication Architecture

| Aspect | Selenium | Playwright |
|--------|----------|------------|
| Protocol | HTTP (WebDriver W3C) | WebSocket (CDP/native protocols) |
| Connection | New HTTP request per command | Persistent WebSocket |
| Latency | Higher (HTTP overhead) | Lower (WebSocket) |
| Browser binary | Separate driver required | Playwright manages browsers |
| Version matching | Driver must match browser | Managed automatically |

### Waiting Strategy

**Selenium (traditional approach):**
```java
// Selenium — explicit waits everywhere
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement element = wait.until(
    ExpectedConditions.elementToBeClickable(By.id("submit"))
);
element.click();
```

**Playwright (auto-waiting):**
```typescript
// Playwright — auto-waits for actionability
await page.click('#submit');  // Automatically waits for element to be visible, enabled, stable
```

Playwright's auto-waiting is built into every action method. When you call `page.click()`, Playwright internally:
1. Waits for the element to be visible
2. Waits for the element to be stable (not animating)
3. Scrolls the element into view
4. Waits for the element to receive pointer events
5. Waits for the element to be enabled (not disabled)
6. Then performs the click

This eliminates the vast majority of timing-related test failures that plague Selenium tests.

### Test Isolation

**Selenium (typical approach):**
```java
// Selenium — shared browser across tests (slow to create)
@BeforeAll
static void setupDriver() {
  driver = new ChromeDriver();
  driver.manage().window().maximize();
}

@Test
void test1() {
  // Uses shared driver
  driver.navigate().to("/login");
  // ...
}

@Test
void test2() {
  // Uses SAME driver state from test1!
  // Must clean up or assume clean state
}

@AfterAll
static void tearDown() {
  driver.quit();
}
```

**Playwright (context-per-test):**
```typescript
// Playwright — isolated context per test
test('test 1', async ({ page }) => {
  // Fresh context, no state from other tests
});

test('test 2', async ({ page }) => {
  // Completely isolated from test 1
});
// No teardown needed — framework handles it
```

### Network Interception

**Selenium:** Limited, requires proxy setup.

**Playwright:** Native, powerful, built-in:
```typescript
// Mock API responses
await page.route('/api/users', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ users: mockUsers }),
  });
});

// Block analytics/tracking requests
await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());

// Modify requests
await page.route('/api/checkout', async (route) => {
  const request = route.request();
  const body = JSON.parse(request.postData() ?? '{}');
  body.discount = 0.1;  // Add 10% discount for testing
  await route.continue({ postData: JSON.stringify(body) });
});
```

### Frames and Shadow DOM

**Selenium:**
```java
// Selenium — manual frame switching (stateful, error-prone)
driver.switchTo().frame("myFrame");
// Now in frame context
driver.findElement(By.id("submit")).click();
driver.switchTo().defaultContent();
// Back in main frame
// If you forget to switchTo().defaultContent(), everything breaks
```

**Playwright:**
```typescript
// Playwright — frame is a first-class object, no switching
const frame = page.frameLocator('#myFrame');
await frame.locator('#submit').click();
// Main page context is unaffected

// Shadow DOM works automatically
await page.locator('#shadow-host >> pierce/#shadow-element').click();
// Or with modern locators:
const host = page.locator('#shadow-host');
await host.locator('#shadow-element').click();
```

---

## 8. Playwright's Browser Types

Playwright supports three browser engines with slightly different behaviors:

### Chromium

The Chrome and Edge rendering engine. Most widely used. Best for:
- Testing Chrome-specific behavior
- Maximum performance
- Best debugging tools support
- CDP is richest in Chromium

```typescript
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
```

### Firefox

Mozilla's engine. Use for:
- Cross-browser testing
- Firefox-specific rendering differences
- Privacy-sensitive testing (Firefox's strict tracking protection)

```typescript
import { firefox } from '@playwright/test';
const browser = await firefox.launch();
```

### WebKit

Safari's engine (via WebKit). Critical for:
- iOS Safari behavior (WebKit is the only engine allowed on iOS)
- macOS Safari testing
- Detecting Safari-only bugs

```typescript
import { webkit } from '@playwright/test';
const browser = await webkit.launch();
```

### Configuring Multiple Browsers in `playwright.config.ts`

```typescript
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],
});
```

The `devices` object contains preset configurations (viewport, user agent, device scale factor) for hundreds of real devices. Running `npx playwright test` with this config automatically runs every test on every configured browser/device.

---

## 9. Launching Browsers — Configuration Options

### Headed vs Headless Mode

**Headless** (default): No browser window opens. Tests run invisibly. Faster.

**Headed**: A real browser window opens and you can watch the test execute. Slower, useful for debugging.

```typescript
// In playwright.config.ts
use: {
  headless: false,  // Show browser window
}

// Or override from command line:
// npx playwright test --headed
```

**In CI/CD:** Always run headless. There is no display available on most CI servers. If you need a display, use `xvfb-run` (on Linux) or configure a virtual display.

### Slow Motion for Debugging

```typescript
use: {
  headless: false,
  launchOptions: {
    slowMo: 500,  // Add 500ms delay between each action
  }
}
```

Slow motion makes it possible to visually watch each action happen. Invaluable when debugging why a test fails.

### Channel: Real Chrome vs Chromium

```typescript
// Use the installed Chrome browser instead of Playwright's Chromium
use: {
  channel: 'chrome',   // Uses system's Chrome
  // or 'msedge' for Microsoft Edge
}
```

Playwright ships with its own modified Chromium build. For testing in production-identical Chrome (e.g., testing Chrome extensions), use `channel: 'chrome'`.

---

## 10. Multi-Page and Multi-Context Patterns

### Testing New Windows and Popups

When a click opens a new window:

```typescript
test('payment window', async ({ page, context }) => {
  await page.goto('/checkout');
  
  // Wait for the new page to open when clicking
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),  // Wait for new page event
    page.click('#pay-with-stripe'), // Action that opens new window
  ]);
  
  await newPage.waitForLoadState();
  await expect(newPage).toHaveURL(/stripe\.com/);
  
  // Interact with Stripe's page
  await newPage.fill('#card-number', '4242424242424242');
  await newPage.click('#pay-button');
  
  // Verify the main page after payment
  await page.waitForURL('/confirmation');
});
```

### Testing Multi-User Scenarios

```typescript
test('real-time collaboration', async ({ browser }) => {
  // Create two separate contexts — two independent users
  const adminContext = await browser.newContext({
    storageState: 'playwright/.auth/admin.json'
  });
  const userContext = await browser.newContext({
    storageState: 'playwright/.auth/user.json'
  });
  
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();
  
  // Admin creates a document
  await adminPage.goto('/documents/new');
  await adminPage.fill('#title', 'Shared Document');
  await adminPage.click('#create');
  const documentId = await adminPage.getAttribute('.document', 'data-id');
  
  // Share with user
  await adminPage.click('#share');
  await adminPage.fill('#share-email', 'user@test.com');
  await adminPage.click('#confirm-share');
  
  // User can now access the document
  await userPage.goto(`/documents/${documentId}`);
  await expect(userPage.locator('.document-title')).toHaveText('Shared Document');
  
  // User edits — admin sees changes in real-time
  await userPage.fill('.editor', 'Hello from user!');
  await expect(adminPage.locator('.editor')).toContainText('Hello from user!', {
    timeout: 5000
  });
  
  // Clean up
  await adminContext.close();
  await userContext.close();
});
```

### The `browser` Fixture for Context Control

By default, Playwright tests receive a `page` fixture (the test runner creates context and page for you). When you need more control, use the `browser` fixture:

```typescript
test('multi-context test', async ({ browser }) => {
  // Manually create contexts for this test
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  // Create pages in each context
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // ... test code ...
  
  // Clean up manually
  await context1.close();
  await context2.close();
  
  // Or let them auto-close when browser fixture tears down
});
```

---

## 11. Network Interception — A Playwright Superpower

Network interception is where Playwright's architecture truly shines. Because Playwright communicates directly with the browser at the protocol level, it has complete visibility and control over all network traffic.

### Why Mock Networks in Tests?

1. **Speed:** Real API calls take time. Mocking makes tests instant.
2. **Reliability:** Real APIs can fail, be rate-limited, or return inconsistent data.
3. **Edge cases:** Testing "what if the API returns a 500?" requires network mocking.
4. **Isolation:** UI tests should test UI behavior, not API behavior.

### Basic Request Interception

```typescript
// Block all image requests (speeds up tests on image-heavy pages)
await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());

// Mock a specific endpoint
await page.route('**/api/users', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ]),
  });
});

await page.goto('/users');
// Page shows Alice and Bob from our mock, not real API
```

### Conditional Mocking

```typescript
// Different responses based on request body
await page.route('**/api/login', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}');
  
  if (body.email === 'valid@test.com') {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ token: 'valid-token', user: { name: 'Valid User' } }),
    });
  } else {
    await route.fulfill({
      status: 401,
      body: JSON.stringify({ error: 'Invalid credentials' }),
    });
  }
});
```

### Modifying Real Responses

```typescript
// Intercept real API response and modify it
await page.route('**/api/feature-flags', async (route) => {
  const response = await route.fetch();  // Get the real response
  const json = await response.json();
  
  // Modify specific flag for testing
  json['new-checkout-flow'] = true;
  
  await route.fulfill({
    response,  // Use original response headers, status
    body: JSON.stringify(json),  // Modified body
  });
});
```

### Capturing Network Traffic for Verification

```typescript
test('analytics are sent on purchase', async ({ page }) => {
  // Collect analytics requests
  const analyticsRequests: string[] = [];
  
  await page.route('**/analytics.google.com/**', async (route) => {
    analyticsRequests.push(route.request().url());
    await route.continue();  // Let the real request proceed too
  });
  
  // Perform the purchase flow
  await completePurchase(page, testProduct);
  
  // Verify analytics were sent
  const purchaseEvents = analyticsRequests.filter(url => 
    url.includes('purchase_complete')
  );
  expect(purchaseEvents).toHaveLength(1);
});
```

---

## 12. Common Mistakes

### Mistake 1: Creating a New Browser per Test (Performance)

```typescript
// ❌ Slow — launching a new browser takes 1-3 seconds
test.beforeEach(async () => {
  browser = await chromium.launch();
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await browser.close();
});

// ✅ Let Playwright manage it — browser is reused, context is fresh per test
test('my test', async ({ page }) => { ... });
```

Playwright's test runner reuses the browser process across tests but creates a fresh context (isolated session) for each test. This gives you isolation without the cost of launching a new browser for every test.

### Mistake 2: Not Closing Contexts in Multi-Context Tests

```typescript
// ❌ Context leak — contexts accumulate, consuming memory
test('multi-user', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();
  // ... test code ...
  // Forgot to close! Memory leak.
});

// ✅ Always close manually created contexts
test('multi-user', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();
  
  try {
    // ... test code ...
  } finally {
    await adminContext.close();
    await userContext.close();
  }
});
```

### Mistake 3: Treating Context as Global State

```typescript
// ❌ Sharing context between tests — breaks isolation
let sharedContext: BrowserContext;

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext();
  // Login once...
});

// Tests share the same context — a failure in one can affect others
```

### Mistake 4: Not Understanding the Difference Between Page URL and Navigation

```typescript
// ❌ page.url() is synchronous — returns current URL immediately
const currentUrl = page.url();  // No await needed

// ❌ But this is wrong in a common pattern:
await page.click('#link');
const newUrl = page.url();  // Might still be the OLD URL if navigation hasn't started
// Need to wait for navigation:
await page.click('#link');
await page.waitForURL('**/new-page');
const newUrl = page.url();  // Now correct
```

---

## 13. Anti-Patterns

### Anti-Pattern 1: Ignoring Context Isolation

```typescript
// ❌ Anti-pattern: "Cleaning" between tests instead of using isolation
test.afterEach(async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
  // Delete cookies...
  // Reset database state...
  // This is fragile — what if you miss something?
});

// ✅ Architecture: Fresh context per test — automatically clean
// Nothing to clean up; the context is destroyed after each test
```

### Anti-Pattern 2: Hardcoded Browser Type

```typescript
// ❌ Anti-pattern: Hardcoded to Chromium only
import { chromium } from 'playwright';
const browser = await chromium.launch();

// ✅ Use the 'browser' fixture — respects configuration
test('works on any configured browser', async ({ browser }) => {
  // Uses whatever browser is configured in playwright.config.ts
  // Run the same test on Chrome, Firefox, WebKit
});
```

### Anti-Pattern 3: Route Without Fulfillment

```typescript
// ❌ Anti-pattern: Intercepting but not handling
await page.route('**/api/data', (route) => {
  // Forgot to call route.fulfill(), route.continue(), or route.abort()
  // Request hangs forever — test times out
});

// ✅ Always handle every intercepted route
await page.route('**/api/data', async (route) => {
  await route.fulfill({ status: 200, body: JSON.stringify(mockData) });
  // or: await route.continue();
  // or: await route.abort();
});
```

---

## 14. Enterprise Perspective

### Browser Reuse Strategy

Enterprise teams configure browser pool settings for optimal performance:

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 4 : 2,  // Parallel workers
  
  // Each worker gets one browser, reused across that worker's tests
  // New context per test within each worker
  
  use: {
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',   // Important for CI (limited shared memory)
        '--no-sandbox',               // Required in some CI environments
        '--disable-gpu',              // Reduces memory in headless mode
      ],
    },
  },
});
```

### Tracing and Diagnostics

Enterprise teams enable tracing in CI for post-failure investigation:

```typescript
use: {
  // Collect traces on first retry only (not on every test — storage cost)
  trace: 'on-first-retry',
  
  // Screenshots on failure
  screenshot: 'only-on-failure',
  
  // Video on failure
  video: 'retain-on-failure',
},
```

The trace file captures:
- Every action with before/after screenshots
- Network requests and responses
- Console messages
- Source code locations

`npx playwright show-trace trace.zip` opens an interactive viewer — essentially a DVR for your test.

### Context Configuration as Code

Enterprise teams create context factory functions for consistency:

```typescript
// fixtures/contexts.ts
async function createAdminContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: 'playwright/.auth/admin.json',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'UTC',
    permissions: ['clipboard-read', 'clipboard-write'],
    extraHTTPHeaders: {
      'X-Test-Runner': 'playwright',
      'X-Test-Environment': process.env.TEST_ENV ?? 'staging',
    },
  });
}
```

---

## 15. Summary

The Playwright architecture is elegantly designed:

### Core Mental Models

**The protocol layer** (WebSocket + CDP) gives Playwright direct, low-latency, bidirectional access to browser internals — far more powerful than Selenium's HTTP-based WebDriver approach.

**The three-layer hierarchy** (Browser → Context → Page) mirrors real browser architecture:
- **Browser:** The running process
- **Context:** An isolated session (like an incognito profile)
- **Page:** A browser tab within that session

**Context is the unit of isolation.** Each test gets a fresh context — fresh cookies, fresh localStorage, fresh permissions. This makes tests independent and enables safe parallelization.

**Network interception** is a first-class feature. Because Playwright operates at the protocol level, it can mock, modify, or observe any network request without proxy servers or additional tooling.

### The Architecture Advantage

```
Selenium model:
  Test → HTTP → Driver → Browser
  Each command: round-trip latency
  Isolation: manual (error-prone)
  Network: requires proxy

Playwright model:
  Test → WebSocket → Browser (directly)
  Each command: low-latency bidirectional
  Isolation: built-in (context per test)
  Network: native CDP interception
```

Understanding this architecture helps you write better tests, debug issues faster, and make informed decisions about when to use single contexts vs multiple contexts, when to mock networks, and how to structure parallel test execution.

### What Comes Next

With the architecture understood, we are ready to dive into the daily practice of writing tests. Chapter 5 covers **Locators** — Playwright's approach to finding elements on the page, why Playwright's locator strategy is fundamentally different from Selenium's, and how auto-waiting is built into every interaction.

---

*Next: Chapter 5 — Locators, Auto-Waiting, and the Actionability Model*
