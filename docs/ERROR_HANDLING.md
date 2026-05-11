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

---

## 🐞 Problem
Raw SQL query failing — `relation "product" does not exist`

## 🔍 Why it happened
PostgreSQL is case-sensitive when identifiers are quoted. Prisma creates tables with quoted PascalCase names (`"Product"`), but raw SQL was written as:
```sql
SELECT * FROM product;
```
`product` (unquoted) is treated as a lowercase identifier — Postgres can't find it.

## ✅ Final Solution
```sql
SELECT * FROM "Product";
```

## 📚 Learning
Prisma schema model names map to quoted PascalCase table names in PostgreSQL. Unquoted identifiers are folded to lowercase by the SQL parser. Whenever writing `$queryRaw` or `$executeRaw`, always double-quote the table name using the exact Prisma model name. Never assume the table name from the query — inspect the actual DB schema first.

---

## 🐞 Problem
Razorpay frontend SDK crash — `.on()` not a function

## 🔍 Why it happened
Razorpay's browser SDK was used like a Node.js EventEmitter:
```js
rzpInstance.on('payment.success', handler)
```
The browser SDK does not expose `.on()`. It is callback-driven via the options object.

## ✅ Final Solution
```js
const rzp = new Razorpay({
  ...options,
  handler: function(response) { /* success */ }
});
rzp.open();
```

## 📚 Learning
Browser SDKs and Node SDKs for the same service often have completely different APIs. Razorpay's browser SDK is not an EventEmitter — it takes a `handler` callback in the options object. Never assume patterns from the server SDK carry over to the client. Always read the browser-specific integration docs separately.

---

## 🐞 Problem
CSP blocking payment gateway (Razorpay)

## 🔍 Why it happened
`checkout.razorpay.com` was not whitelisted in `script-src` or `connect-src`.

## ✅ Final Solution
```
script-src 'self' checkout.razorpay.com
connect-src 'self' api.razorpay.com
```

## 📚 Learning
Payment gateways load external scripts and make cross-origin API calls — both blocked by CSP if not explicitly whitelisted. The failure is silent (browser blocks, no visible error in UI). Add payment gateway domains to CSP at integration time, not after debugging a production failure. This compounds the earlier CSP lesson: every new external service requires a CSP audit.

---

## 🐞 Problem
Prisma migration failing with P3006 — shadow DB replay error

## 🔍 Why it happened
Migration contained:
```sql
DROP INDEX "product_location_gist";
```
The shadow DB (used by Prisma to replay migrations from scratch) never had this index created, so the drop failed during replay.

## ✅ Final Solution
```sql
DROP INDEX IF EXISTS "product_location_gist";
```

## 📚 Learning
Prisma replays all migrations in sequence on a clean shadow DB during `migrate dev`. Any migration that assumes pre-existing state (an index, a column, an extension) will fail on replay if that state wasn't created in a prior migration in the same sequence. All destructive DDL (`DROP INDEX`, `DROP COLUMN`, `ALTER TABLE`) must use `IF EXISTS`. Migrations must be idempotent and environment-independent.

---

## 🐞 Problem
Migration failing — cannot add `NOT NULL` column to non-empty table

## 🔍 Why it happened
```sql
ALTER TABLE "User" ADD COLUMN pinHash TEXT NOT NULL;
```
Existing rows have no value for `pinHash`, violating the `NOT NULL` constraint immediately.

## ✅ Final Solution
Split into a multi-step migration:
1. Add column as nullable: `ADD COLUMN pinHash TEXT`
2. Backfill existing rows: `UPDATE "User" SET pinHash = '...'`
3. Apply constraint: `ALTER COLUMN pinHash SET NOT NULL`
4. Drop old column if replacing one

## 📚 Learning
`NOT NULL` columns cannot be added to tables with existing rows unless a `DEFAULT` is provided or the column is backfilled first. This is a standard zero-downtime migration pattern. Any schema change that introduces a new constraint must account for existing data — schema changes and data migrations are separate concerns that must be sequenced correctly.

---

## 🐞 Problem
Prisma migration checksum mismatch error

## 🔍 Why it happened
An already-applied migration file was edited after the fact. Prisma stores a SHA-256 checksum of each migration in `_prisma_migrations`. Editing the file breaks the checksum.

## ✅ Final Solution
Restore the original migration file. If the fix must be applied, create a new migration for the change. As a last resort in dev, update the checksum in `_prisma_migrations` manually.

## 📚 Learning
Applied migrations are immutable. Prisma's checksum mechanism enforces this — it's a safeguard, not an obstacle. The correct fix for a broken migration is always a new forward migration, never editing history. Treat migration files the same way you treat git history: rewriting it creates downstream divergence.

---

## 🐞 Problem
Migration order dependency — `ALTER TABLE` ran before the table was created

## 🔍 Why it happened
A PostGIS extension migration ran before the base schema migration that created the `Product` table. The `ALTER TABLE` in the PostGIS migration referenced a table that didn't yet exist.

## ✅ Final Solution
Ensure migration sequence follows dependency order:
1. Base schema (model tables)
2. Extensions and custom types
3. Dependent changes (indexes, PostGIS columns, constraints)

## 📚 Learning
Prisma runs migrations in filename order (timestamp-prefixed). Migration ordering is a design constraint — dependencies between migrations must be reflected in their sequence. When adding PostGIS, geospatial indexes, or any feature that modifies existing tables, the base table must already exist in a prior migration.

---

## 🐞 Problem
Cart allowed duplicate items — same product + window + date inserted multiple times

## 🔍 Why it happened
Cart writes used `create()` with no uniqueness enforcement. Concurrent or repeated requests created duplicate rows, producing incorrect totals and race condition exposure.

## ✅ Final Solution
Enforce business invariant at the DB level:
```prisma
@@unique([cartSessionId, productId, pickupWindowId, pickupDate])
```
Use `upsert()` instead of `create()` for all cart writes.

## 📚 Learning
Business invariants (e.g. "one cart entry per product per pickup slot") must be enforced at the database layer, not just application logic. Application-level checks are vulnerable to race conditions under concurrent requests. `@@unique` constraints + `upsert()` is the correct pattern: the DB rejects violations atomically, and `upsert` makes writes idempotent by default.

---

## 🐞 Problem
Partial state after multi-step write — cart expiry updated but item not created

## 🔍 Why it happened
Multiple Prisma writes executed sequentially without a transaction. A failure mid-sequence left the DB in a partially updated state.

## ✅ Final Solution
```js
await prisma.$transaction([
  prisma.cartItem.upsert(...),
  prisma.cartSession.update(...)
]);
```

## 📚 Learning
Any operation that requires multiple writes to remain consistent must be wrapped in a transaction. Prisma's `$transaction()` makes this explicit. "It works in practice" is not a substitute for atomicity — partial writes cause silent data corruption that surfaces as hard-to-reproduce bugs. Treat every multi-write operation as a transaction by default.

---

## 🐞 Problem
Date comparison bug — past dates passing validation

## 🔍 Why it happened
```js
date > new Date()
```
`new Date()` includes the current time (hours, minutes, seconds, milliseconds). A date set to today's date at midnight would fail this check even though the day is valid.

## ✅ Final Solution
```js
const today = new Date();
today.setHours(0, 0, 0, 0);
if (date < today) throw error;
```

## 📚 Learning
JavaScript `Date` objects carry time components. Comparisons between dates that should be day-granularity will behave unexpectedly if time isn't normalized. Always strip time (`setHours(0,0,0,0)`) before comparing calendar dates. This applies everywhere: pickup dates, expiry dates, scheduling logic, any date-only business rule.

---

## 🐞 Problem
Zod schema and service layer performing overlapping validation

## 🔍 Why it happened
The same business rule was validated in both the Zod schema (at the request boundary) and inside the service function. When the rule changed, only one location was updated, causing inconsistency.

## ✅ Final Solution
Enforce strict layer separation:
- **Zod** → input shape and format validation (types, lengths, required fields)
- **Service layer** → business rules (availability, ownership, state machine transitions)

## 📚 Learning
Zod and service-layer validation answer different questions. Zod asks: "Is this input well-formed?" The service asks: "Is this operation permitted given current business state?" Mixing them creates duplication and divergence. Business rules that depend on DB state or domain logic don't belong in schemas — schemas don't have access to that context.

---

## 🐞 Problem
Migration marked as applied in `_prisma_migrations` but DDL never executed on real DB

## 🔍 Why it happened
The checksum update trick (`UPDATE "_prisma_migrations" SET finished_at = NOW()...`) only writes to Prisma's metadata table. It tells Prisma "this migration is done" but does not execute the actual SQL (`ALTER TABLE`, `CREATE INDEX`, etc.) against the real database. The two operations are completely independent.

## ✅ Final Solution
After faking a migration as applied, manually execute the DDL directly:
```cmd
npx prisma db execute --file prisma\migrations\<timestamp>_migration_name\migration.sql
```
Or pipe individual statements:
```cmd
echo ALTER TABLE "User" RENAME COLUMN "pin" TO "pinHash"; | npx prisma db execute --stdin
```

## 📚 Learning
`_prisma_migrations` is a bookkeeping table — writing to it has zero effect on the actual schema. Any time you bypass `migrate dev` (via checksum updates, `--applied` flags, or direct `_prisma_migrations` edits), you must separately ensure the DDL was actually applied. Always verify with a known-good query or app behaviour test, not just `prisma migrate status`.

---

## 🐞 Problem
`prisma db execute` shows "Script executed successfully" for SELECT queries but never outputs rows

## 🔍 Why it happened
`prisma db execute` is a script runner, not a SQL client. It executes SQL and reports success or failure. It does not render query result sets. SELECT queries run, return data to the driver, and the driver discards it.

## ✅ Final Solution
Use Neon's built-in SQL editor for inspection queries, or infer column existence from app behaviour (if the app works, the column exists).

## 📚 Learning
`prisma db execute` is for applying DDL/DML, not inspecting data. Never use it to verify schema state — its output cannot confirm whether a column or index exists. Use the DB console, `psql`, or TablePlus for inspection. Alternatively, attempt the operation and treat the error message itself as the verification signal (e.g. `column already exists` confirms presence).

---

## 🐞 Problem

`DO $$` block silently skipped `ADD COLUMN` — `pinHash` not created despite "Script executed successfully"

## 🔍 Why it happened
The `IF NOT EXISTS` check inside the DO block queried `information_schema.columns` with `table_name = 'User'`. PostgreSQL's `information_schema` stores table names in their exact created case. The check appeared to match but the conditional evaluated unexpectedly, causing the `ALTER TABLE ADD COLUMN` branch to be silently skipped with no error.

## ✅ Final Solution
Bypass the DO block entirely and run the DDL directly:
```cmd
echo ALTER TABLE "User" ADD COLUMN "pinHash" TEXT NOT NULL DEFAULT ''; | npx prisma db execute --stdin
```

## 📚 Learning
`DO $$` blocks swallow internal errors and produce no output — a failed or skipped branch inside a PL/pgSQL block is invisible to the caller. Never use anonymous DO blocks for critical schema changes when you need confirmation of execution. Prefer direct, unconditional DDL with `IF NOT EXISTS` / `IF EXISTS` guards at the statement level, not inside procedural logic.

---

## 🐞 Problem
Neon DB unreachable — P1001 `Can't reach database server`

## 🔍 Why it happened
Neon free tier enforces a monthly compute hour limit. Once exhausted, the compute instance is suspended and all connections are refused until the quota resets or the plan is upgraded.

## ✅ Final Solution
Three options in order of speed:
1. Upgrade Neon plan (instant)
2. Migrate to a different free-tier Postgres (Supabase / Railway) and run `npx prisma migrate deploy`
3. Wait for monthly quota reset

## 📚 Learning
Serverless database free tiers have hard compute caps, not just storage caps. P1001 during active development almost always means the instance is suspended, not a network or credentials issue. Design dev workflows to be resilient to DB unavailability: keep migration files idempotent so `migrate deploy` can replay cleanly on a fresh instance at any time.

---

## 🐞 Problem
Stale Prisma client causing `column User.pinHash does not exist` despite column being present in DB

## 🔍 Why it happened
`npx prisma generate` had been run previously but the Next.js `.next` build cache retained compiled chunks referencing the old client. Turbopack served the cached module without recompiling.

## ✅ Final Solution
```cmd
npx prisma generate
rmdir /s /q .next
npm run dev
```

## 📚 Learning
`prisma generate` updates the client in `node_modules` but does not invalidate the Next.js build cache. If a Prisma schema change is not reflected in app behaviour despite `generate` running, the `.next` cache is serving stale compiled output. Always delete `.next` after any Prisma schema or client change during active development.