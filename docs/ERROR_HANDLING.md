## 🐞 Problem
React.Children.only expected to receive a single React element child

## 🔍 Why it happened
Use of `Comp = asChild ? Slot : 'button'` in Button UI.
When `asChild: true` → `<Comp>...</Comp>` → actually `<Slot>{multiple elements}</Slot>`

## ✅ Final Solution
Store content in variable: `const content = (<>...</>)` ; then use as:
`<Comp ...>{asChild ? children : content}</Comp>`

## 📚 Learning
Radix UI's `Slot` component enforces a single-child constraint using `React.Children.only`. When `asChild` is enabled, any multi-element children (icons + text) violate this. Always ensure a single wrapper or conditionally pass one child into Slot-based components. This pattern applies to any Radix primitive that accepts `asChild`.

---

## 🐞 Problem
Logged-in user able to access auth routes (login/register).

## 🔍 Why it happened
Cookie check was placed inside a `useEffect` on the client — auth guard ran after `useAuth` resolved its `GET /api/users/me`, causing a visible flash of the login form for already-authenticated users.

## ✅ Final Solution
Cookie check in auth `layout.tsx` (server-side), before the page renders.

## 📚 Learning
`useEffect` fires after mount. On slow connections (2G, Tier-2), this window is 2–4 seconds.
TanStack Query starts with no cached data → `isLoggedIn` is `false` initially → the `useEffect` guard never fires on first render.
The flow: render → `authLoading: true, isLoggedIn: false` → fetch completes → now redirects.
Auth guards belong at the layout/server level. Client-side guards are UX-only, not security gates.

---

## 🐞 Problem
Cookie not persisting → login fails → redirect loop

## 🔍 Why it happened
Cookie path was scoped too narrowly:
```
path: "/api/admin"
```
Flow after login:
1. `POST /api/admin/auth/login` ✅
2. Navigate → `/admin/sellers` ❗
3. React calls `/api/admin/sellers`

Browser evaluates future usability of the cookie at set time. Because the app immediately transitions to `/admin/*` (a non-API route), the browser determines the cookie is too restricted to be broadly useful and silently drops it.

## ✅ Final Solution
```
path: "/"
```

## 📚 Learning
Browsers do not blindly store cookies. The `path` attribute is evaluated against the full expected request surface of the app. If the cookie's path doesn't cover where future requests will originate (e.g., navigation routes triggering API calls), the browser may silently drop the cookie. Always set `path: "/"` unless you have a deliberate, narrow scope requirement.

---

## 🐞 Problem
Auth redirect loop (`/login ↔ /dashboard` infinite loop)

## 🔍 Why it happened
Two conflicting redirect systems:
1. LoginPage → redirects if cookie exists
2. AuthGuard → redirects if not logged in

AuthGuard ran before auth state resolved → `user = undefined` treated as unauthenticated.

## ✅ Final Solution
Fix auth state tri-state handling:
```js
const isLoggedIn = user !== undefined && user !== null;
// Block early redirect:
if (loading) return;
```

## 📚 Learning
React Query has 3 auth states — not 2:
- `undefined` → loading (query hasn't resolved)
- `null` → unauthenticated
- `object` → authenticated

Treating `undefined` as `false` is the root cause of most auth flicker and redirect loops. Never conflate `undefined` and `null`. Define responsibility clearly across systems: Middleware → auth existence check; Server page → redirect logged-in users; Client guard → UX only.

---

## 🐞 Problem
Login redirect always going to `/` instead of intended route

## 🔍 Why it happened
```js
redirect(searchParams.redirect || '/')
// But: searchParams.redirect = "%2Fseller%2Fdashboard" (URL-encoded)
```
Next.js server-side `redirect()` does not auto-decode query params.

## ✅ Final Solution
```js
const redirectUrl = decodeURIComponent(searchParams.redirect)
```

## 📚 Learning
Client-side navigation auto-decodes query params. Server-side does not. `decodeURIComponent` is required before using any query param as a redirect target on the server. This is especially relevant when the redirect URL is set by client-side navigation (e.g. `router.push('/login?redirect=/seller/dashboard')`).

---

## 🐞 Problem
`searchParams` access throwing error in Next.js App Router

## 🔍 Why it happened
`searchParams` is now async (Promise) in newer Next.js versions. Direct access without `await` throws.

## ✅ Final Solution
```js
const params = await searchParams;
```

## 📚 Learning
Next.js App Router is async-first. `searchParams`, `params`, and several other page-level APIs are Promises in recent versions. Always `await` them in server components. Check the Next.js changelog when upgrading — async API surface changes are common and breaking.

---

## 🐞 Problem
Zod validation order breaking custom error messages

## 🔍 Why it happened
```js
z.string().length(10)
```
Zod generates its own default error. Custom `.regex()` chained after `.length()` never fires because Zod stops at the first failure.

## ✅ Final Solution
```js
phone: z
  .string()
  .min(10, "PHONE_LENGTH")
  .max(10, "PHONE_LENGTH")
  .regex(/^[0-9]+$/, "PHONE_INVALID")
```

## 📚 Learning
Zod validates sequentially and stops at first failure. `.length()` uses non-customizable default messages. Use `.min()` + `.max()` with explicit error keys instead. Always use i18n error keys, not raw strings — raw strings break consistency across locales and UX systems.

---

## 🐞 Problem
`.omit()` not working on a Zod schema

## 🔍 Why it happened
Schema had `.refine()` applied. Refined schemas are locked — structural transforms like `.omit()`, `.pick()`, `.merge()` cannot be applied after refinement.

## ✅ Final Solution
Create a separate base schema without `.refine()` for structural use:
```js
const FormSchema = z.object({ ... })         // structural ops here
const ValidatedSchema = FormSchema.refine(...) // refinements after
```

## 📚 Learning
In Zod, `.refine()` wraps the schema in a `ZodEffects` type. Once wrapped, you lose access to object-level methods. Design schemas with this constraint in mind — separate structural shape from validation logic, and apply refinements last.

---

## 🐞 Problem
`superRefine` enforcing rule on fields marked optional

## 🔍 Why it happened
`imageUrls` present but `blurHash` missing. Schema used `superRefine` to conditionally require `blurHash` when `imageUrls` existed — but the field was typed optional.

## ✅ Final Solution
Generate blurHash at upload time (co-located with image processing), not as an afterthought at validation.

## 📚 Learning
`optional()` means "not required at schema level." It does NOT mean "never conditionally required." `superRefine` operates on the full object and can impose constraints between fields regardless of individual field optionality. Conditional requirements belong in the data pipeline (generate the data before it hits validation), not in schema workarounds.

---

## 🐞 Problem
CSP silently blocking external services (Cloudinary, Sentry, Neon, Upstash)

## 🔍 Why it happened
Missing `connect-src` rules in Content Security Policy header.

## ✅ Final Solution
```
connect-src 'self'
  https://api.cloudinary.com
  https://*.sentry.io
  *.neon.tech
  *.upstash.io
```

## 📚 Learning
CSP blocks network requests silently — no visible error, just a console entry. Third-party widgets (Cloudinary upload widget, Sentry SDK) require both frontend config AND CSP whitelisting. Build a CSP audit into your integration checklist: every new external service = a new `connect-src` (or `script-src`, `img-src`) entry. Discover failures in local dev, not production.

---

## 🐞 Problem
Neon DB connection errors on first request (cold start)

## 🔍 Why it happened
Neon free tier auto-suspends DB after inactivity. First request after suspension fails with WebSocket / network error.

## ✅ Final Solution
```js
withRetry(async () => prisma.query())
```
Or: keep-alive cron ping. Or: accept cold start as a known constraint of the free tier.

## 📚 Learning
Serverless databases are not equivalent to always-on databases. Design for cold starts from day one: retry wrappers at the infra layer, user-visible loading states, and clear SLA expectations. Free-tier infra constraints directly shape architecture decisions — always read plan limits before building around a service.

---

## 🐞 Problem
Nested `<button>` causing hydration crash

## 🔍 Why it happened
`<CldUploadButton>` rendered a `<button>` internally. Wrapping it with a `<Button>` component also rendered a `<button>`, creating invalid HTML nesting.

## ✅ Final Solution
```jsx
<Button asChild>
  <CldUploadButton />
</Button>
```
OR remove the inner button entirely.

## 📚 Learning
HTML disallows interactive element nesting (`<button>` inside `<button>`, `<a>` inside `<a>`). This produces hydration mismatches in React because the browser auto-corrects invalid HTML during parsing, producing a DOM that doesn't match the server-rendered output. Use `asChild` patterns (Radix, shadcn) to delegate rendering without adding a new DOM node.

---

## 🐞 Problem
`Prisma.InputJsonValue` type not used for JSON fields

## 🔍 Why it happened
Passing a plain object to a Prisma model call where the schema field is typed as `Json`. Prisma requires its own wrapper type to ensure type safety on JSON columns.

## ✅ Final Solution
Use `Prisma.InputJsonValue` when passing JSON-typed data in the repository layer.

## 📚 Learning
Prisma's `Json` field type does not accept raw `object` — it requires `Prisma.InputJsonValue`. This is easy to miss because the runtime behavior may work, but TypeScript will surface the mismatch. Enforce this at the repository boundary so service/controller layers remain type-clean.

---

## 🐞 Problem
Multiple auth systems overlapping → redirect instability

## 🔍 Why it happened
Three separate systems all performing auth redirects:
- LoginPage client-side redirect
- AuthGuard client-side redirect
- Middleware redirect

Each system had subtly different conditions, causing conflicts and loops.

## ✅ Final Solution
Assign explicit, non-overlapping responsibility:
- **Middleware** → verifies auth token existence only
- **Server page/layout** → redirects logged-in users away from auth pages
- **Client guard** → UX feedback only (loading states, conditional rendering)

## 📚 Learning
Overlapping redirect logic across layers is one of the most common sources of auth instability. Each layer should own a distinct concern with no fallback from another layer compensating for it. When adding a new auth check, first identify which layer owns that responsibility — don't add it to all three "just in case."