# Kridha — Engineering Learnings & Incident Runbook

> A living document of real problems encountered during development, their root causes, and the exact fix sequence. Refer here before Googling.

---

## Table of Contents

1. [Prisma Migration Failure — Generated Column Conflict](#1-prisma-migration-failure--generated-column-conflict)
2. [PrismaClient Initialization Error — Rate Limiter](#2-prismaclient-initialization-error--rate-limiter)
3. [Database Migration: Neon → Supabase](#3-database-migration-neon--supabase)
4. [Prisma Client Regeneration & Production Build](#4-prisma-client-regeneration--production-build)
5. [XSS Prevention — Practical Fixes](#5-xss-prevention--practical-fixes)

---

*1st addition: May 17th 2026 — add new incidents below.*

---

## 1. Prisma Migration Failure — Generated Column Conflict

### What Happened
Adding a new migration for the `UserSession` model caused a cascade of migration failures. 
Root cause: the `location` column on the `Product` table is a **PostgreSQL generated column** (`GENERATED ALWAYS AS ... STORED`). Prisma's shadow database migration process attempted to re-create it using a default column definition, which Postgres rejects.

### Root Cause
PostgreSQL generated columns cannot be altered using standard `ALTER TABLE ... SET DEFAULT` syntax. Prisma's migration engine hit this when applying the migration to its shadow database during `prisma migrate dev`.

---

### Error 1 — Migration Drift Detected

**Error message:**
```
Migration was modified after it was applied.
Drift detected: the database schema is not in sync with the migration history.
```

**Cause:** A migration file was manually edited or a migration was applied outside of Prisma's control, causing the local migration history to diverge from the actual DB state.

**Fix sequence:**
```cmd
npx prisma migrate reset          # Wipes DB + re-applies all migrations from scratch
npx prisma migrate status         # Confirm clean state — all migrations should show "Applied"
npx prisma migrate dev --create-only -n "add_user_session_model"  # Create migration file without applying
npx prisma migrate dev            # Apply all pending migrations
```

> ⚠️ `migrate reset` wipes all data. Only safe in development. Never run against production.

---

### Error 2 — Shadow Database Rejects Generated Column (P3006)

**Error message:**
```
P3006: Migration `20260516092938_add_user_session_model` failed to apply cleanly to the shadow database.
ERROR: column "location" of relation "Product" is a generated column
HINT: Use ALTER TABLE ... ALTER COLUMN ... DROP EXPRESSION instead.
```

**Cause:** The migration SQL Prisma generated tried to redefine the `location` column. Because `location` is `GENERATED ALWAYS AS (ST_SetSRID(...))`, Postgres blocks any attempt to set a default on it — it only allows `ALTER TABLE ... ALTER COLUMN ... DROP EXPRESSION`.

**Fix sequence:**
```cmd
npx prisma migrate reset
npx prisma migrate status
npx prisma migrate dev --create-only -n "add_user_session_model"
# ⬆ Open the generated migration file and manually remove any SQL touching the `location` column
npx prisma migrate dev
```

> 💡 After `--create-only`, inspect the SQL file in `prisma/migrations/` before applying. Remove any `ALTER TABLE "Product" ALTER COLUMN "location"` statements.

---

### Error 3 — Failed Migration Blocks All Future Migrations (P3018)

**Error message:**
```
P3018: A migration failed to apply. New migrations cannot be applied before the error is recovered from.
Migration name: 20260516093503_add_user_session_model
Database error code: 42601
ERROR: column "location" of relation "Product" is a generated column
```

**Cause:** Prisma marks a failed migration as "failed" in the `_prisma_migrations` table. Until this is resolved, no further migrations can be applied.

**Fix sequence:**
```cmd
# Step 1: Mark the failed migration as rolled back in Prisma's internal tracking table
npx prisma migrate resolve --rolled-back "20260516093503_add_user_session_model"

# Step 2: Delete the failed migration folders (both attempts)
rmdir /s /q "prisma\migrations\20260516092938_add_user_session_model"
rmdir /s /q "prisma\migrations\20260516093503_add_user_session_model"

# Step 3: Verify remaining migrations are clean
dir prisma\migrations
type "prisma\migrations\20260516093336_add_user_session_model\migration.sql"

# Step 4: Confirm status and regenerate client
npx prisma migrate status
npx prisma generate
```

---

### Prevention Going Forward

When writing any migration that touches the `Product` table, manually inspect the generated SQL before applying:

```cmd
npx prisma migrate dev --create-only -n "your_migration_name"
# Review the file at prisma/migrations/<timestamp>_your_migration_name/migration.sql
# Remove any lines referencing the `location` column
npx prisma migrate dev
```

The `location` column is `Unsupported("geography(Point,4326)")` in the Prisma schema — Prisma cannot manage it. Treat it as invisible to Prisma migrations. All `location` column management must happen via raw SQL.

---

## 2. PrismaClient Initialization Error — Rate Limiter

### What Happened
The rate limiter middleware threw a `PrismaClientInitializationError` in production. The Prisma client was being constructed without required options when using the Neon adapter.

### Error Message
```
[14:22:22] ERROR: Rate limiter failed
PrismaClientInitializationError: `PrismaClient` needs to be constructed
with a non-empty, valid `PrismaClientOptions`

  18 | // Development: plain Prisma
> 19 |   return new PrismaClient();
     |          ^
```

### Root Cause
The Neon adapter (`@prisma/adapter-neon`) requires `PrismaClient` to be constructed with an explicit `adapter` option. Calling `new PrismaClient()` without it fails when Neon is in the dependency graph — Prisma 7+ enforces this when a driver adapter is present.

### Fix Sequence
```cmd
# Step 1: Clean uninstall of Neon-specific packages
npm uninstall @neondatabase/serverless @prisma/adapter-neon

# Step 2: Reinstall to clean lockfile
npm install

# Step 3: Regenerate Prisma client for updated dependency tree
npx prisma generate

# Step 4: Verify production build compiles cleanly
npm run build
```

> This was also the trigger for migrating from Neon to Supabase. See [Section 3](#3-database-migration-neon--supabase).

---

## 3. Database Migration: Neon → Supabase

### Why Neon Was Dropped

| Issue | Impact |
|---|---|
| Sleeps after 5 min of inactivity | Required a keep-alive cron (`SELECT 1`) — operational overhead |
| Limited CPU hours on free tier | DB exhausted mid-month during seeding and development |
| Branching useful but not enough | Neon's main advantage (branching for test isolation) didn't justify the free tier limits |

### Why Supabase Was Chosen

| Feature | Benefit |
|---|---|
| No CPU hours limit | Development and seeding don't count against a monthly cap |
| Generous free tier | Avoids mid-month exhaustion during active development |
| Row-level locking | `SELECT FOR UPDATE` works correctly — critical for Kridha's stock invariants |
| Always-on | No cold start / wake-up delay |
| PostGIS available | Extension supported — `location` geography column works |

---

### Migration Steps

**Step 1 — Supabase project setup**

Create a project at [supabase.com](https://supabase.com). From the project dashboard, retrieve:
- **Direct URL** — for Prisma migrations (`DIRECT_URL`)
- **Pooled URL** — for the application (`DATABASE_URL`) [Prisma uses pooled url in produtcion automatically internally, without any setup]

**Step 2 — Update environment variables**

```cmd
# .env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

**Step 3 — Remove Neon dependencies**

```cmd
npm uninstall @neondatabase/serverless @prisma/adapter-neon
npm install
```

**Step 4 — Update `lib/db.ts`**

Replace the Neon adapter pattern with the standard Prisma singleton:

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

// Singleton — prevents new PrismaClient instances on every hot reload in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Step 5 — Update `prisma/schema.prisma` & `prisma.config.ts`**

Ensure `directUrl` is set for migrations:

```prisma
datasource db {
  provider  = "postgresql"
}
```
```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
```

**Step 6 — Apply migrations to Supabase**

```cmd
npx prisma migrate deploy    # Applies all existing migrations to Supabase
npx prisma generate          # Regenerate client
npm run build                # Verify clean production build
```

**Step 7 — Enable Extensions in Supabase**

Supabase Dashboard → SQL Editor → Run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify both installed
SELECT name, default_version 
FROM pg_available_extensions 
WHERE name IN ('postgis', 'pg_trgm');

```

---

## 4. Prisma Client Regeneration & Production Build

### When to Run These

Run `npx prisma generate` any time:
- Schema (`schema.prisma`) is changed
- Prisma version is upgraded
- Switching database providers
- After `npm install` if `postinstall` script is absent

Run `npm run build` after:
- Any environment or config change
- Switching DB providers
- Before deploying to production

### Commands

```cmd
# Regenerate Prisma client to reflect latest schema
npx prisma generate

# Build production-ready Next.js output
npm run build
```

### Add to `package.json` (prevents forgetting)

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

`postinstall` runs automatically after every `npm install` — Prisma client is always in sync with the schema.

---

## 5. XSS Prevention — Practical Fixes

### What Is XSS

Cross-Site Scripting (XSS) occurs when user-supplied input containing malicious scripts (`<script>`, event handlers, `javascript:` URIs) is rendered in a browser without sanitization. In Kridha's context, the highest risk is stored XSS via product descriptions and seller store names submitted through the API.

---

### Fix 1 — Audit for `dangerouslySetInnerHTML`

React escapes all content by default. `dangerouslySetInnerHTML` is the only way React renders raw HTML — it bypasses escaping entirely.

**Audit command (Windows):**
```cmd
findstr /s /n "dangerouslySetInnerHTML" src\
```

**Rule:** If any `dangerouslySetInnerHTML` result appears in a component that renders user-supplied content (product names, descriptions, comments), it must be replaced with a sanitized alternative or removed.

---

### Fix 2 — Strip HTML at the Zod Schema Layer

Strip HTML tags from all user-supplied string fields **before** they reach the database. This prevents stored XSS regardless of how the content is rendered.

**Define a reusable sanitized string helper in `schemas/index.ts`:**

```typescript
// schemas/index.ts

/**
 * safeString — strips all HTML tags from user input before validation.
 * Uses a regex that matches any <tag> pattern including attributes and closing tags.
 * Applied to all user-submitted text fields: product names, descriptions, comments.
 *
 * Example:
 *   Input:  "Mustard Oil <script>alert(1)</script>"
 *   Output: "Mustard Oil"
 */
const safeString = () =>
  z.string().transform((s) => s.replace(/<[^>]*>/g, "").trim());
```

**Apply to all user-submitted text fields:**

```typescript
export const RegisterAsSellerSchema = z.object({
  storeName: safeString().pipe(z.string().min(3, "STORE_NAME_SHORT").max(100)),
  street: safeString().pipe(z.string().min(5, "STREET_SHORT").max(200)),
  line2: safeString().pipe(z.string().max(100)).optional(),
  landmark: safeString().pipe(z.string().max(100)).optional(),
  city: safeString().pipe(z.string().min(2, "CITY_SHORT").max(50)),
  state: safeString().pipe(z.string().min(2, "STATE_SHORT").max(50)),

  ... everywhere else required.
```

**Layers this creates:**

```
User input
  → Zod safeString() strips <tags> at schema layer       (Layer 1 — input sanitization)
  → Prisma parameterized query prevents SQL injection     (Layer 2 — DB safety)
  → React escapes content on render by default            (Layer 3 — output encoding)
  → No dangerouslySetInnerHTML on user content            (Layer 4 — render safety)
```

---

### Checklist Before Shipping Any User-Facing Input Field

- [ ] Field uses `safeString()` or equivalent in its Zod schema
- [ ] No `dangerouslySetInnerHTML` renders the field's value
- [ ] If rich text is needed: use a whitelist sanitizer (DOMPurify), not a blocklist
- [ ] Content Security Policy header prevents inline script execution
- [ ] `findstr /s /n "dangerouslySetInnerHTML" src\` returns no results on user-content components

---

---
# Fix the Prisma adapter error for Database_url

-> In Prisma 7, when using an adapter like @prisma/adapter-pg, PrismaClient must be created with a valid options object.
-> import { PrismaPg } from "@prisma/adapter-pg";
-> const adapter = new PrismaPg({
  connectionString:
    process.env.NODE_ENV === "production"
      ? process.env.DATABASE_URL!
      : (process.env.DIRECT_URL ?? process.env.DATABASE_URL!),
});

-> const prisma = new PrismaClient({
  adapter,
});

##  Prisma 7 requirements:
-> prisma.config.ts for Migrate
-> adapter for the runtime client

## Why DATABASE_URL is still in db.ts
Because my runtime client is using @prisma/adapter-pg, Prisma no longer auto-reads the connection URL from schema.prisma. I have to explicitly pass it in the adapter config. In production, it uses DATABASE_URL (which is the pooled URL for Supabase). In development, it prefers DIRECT_URL (the non-pooled URL for migrations) but falls back to DATABASE_URL if DIRECT_URL is not set.

### Supabase connection url must have spaces & special characters encoded
-> Supabase URLs often contain special characters (like `@`, `:`, `/`) in the username, password, or host. These must be percent-encoded to be parsed correctly by Prisma and PostgreSQL.

---

---
### Production - Migration Steps
1. Ensure all migrations are applied to the new Supabase database using `npx prisma migrate deploy`.
2. Update environment variables in production to point to the new Supabase database.
3. Verify that the application can connect to the new database and that all features work as expected.

## Step 1 — Point your env to Supabase temporarily
Open your .env file and confirm these point to Supabase, not Docker:
### # .env — switch to Supabase values before running any migration commands

### DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
### DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
The DIRECT_URL is what Prisma uses for migrations — it bypasses PgBouncer and connects directly. Migrations must use the direct connection, not the pooled one.

## Step 2 — Check what Supabase currently knows
### npx prisma migrate status
What this does: Reads prisma/migrations/ folder and compares against the _prisma_migrations table in whichever DB your DIRECT_URL points to. Shows which migrations are applied, pending, or failed.

### Expected output before deploy:
Following migration(s) have not yet been applied:
  20260516093336_add_user_session_model

## Step 3 — Apply all pending migrations to Supabase
### npx prisma migrate deplo
What this does:
Reads every .sql file in prisma/migrations/ in chronological order
Checks _prisma_migrations table in Supabase to see which are already applied
Runs only the ones not yet applied
Records each in _prisma_migrations on success
Stops immediately if any migration fails — does not skip or continue

What it does NOT do:
Does not reset anything
Does not create new migrations
Does not run prisma generate
Does not touch your data


## Step 4 — Regenerate Prisma client
### npx prisma generate
What this does: Regenerates the TypeScript client based on your schema.prisma. Run this after every migration deploy so your code matches the new schema.

## Step 5 — Verify
### npx prisma migrate status
All migrations should now show Applied.

## Step 6 — Switch env back to Docker for local dev
 ### # .env — switch back to Docker values

DATABASE_URL="postgresql://kridha:secret@localhost:5432/kridha_dev"

DIRECT_URL="postgresql://kridha:secret@localhost:5432/kridha_dev"

---

---
# How to Avoid the Location Column Loop — Permanently

## Why It Happens?
The location column on Product is:
### prisma:  location Unsupported("geography(Point, 4326)")?
Prisma marks it Unsupported — it knows this type exists but cannot manage it. The problem occurs when you run prisma migrate dev to create a new migration for something else (like userSession). Prisma introspects the schema, sees the location column, and sometimes generates SQL that tries to ALTER TABLE "Product" ALTER COLUMN "location" — which Postgres rejects because generated columns cannot be altered with standard syntax.

## The Prevention Protocol — Follow Every Time You Create a New Migration
Never use this:
npx prisma migrate dev --name "your_migration"    # ← creates AND applies immediately
Always use this instead:
### Step 1: Create the migration file WITHOUT applying it
npx prisma migrate dev --create-only --name "your_migration"
What --create-only does: Generates the SQL file in prisma/migrations/ but does not execute it. Gives you a chance to inspect and edit first.

### Step 2: Open and inspect the generated SQL file
#### File will be at: prisma/migrations/<timestamp>_your_migration/migration.sql

In VS Code terminal:
#### View the file (replace timestamp)
prisma\migrations\20260516093336_add_user_session_model\migration.sql

### Step 3: Search for and delete any line touching location:
Look for anything like:
#### sql:
-- DELETE any of these if present:
ALTER TABLE "Product" ALTER COLUMN "location" SET DEFAULT ...;
ALTER TABLE "Product" ALTER COLUMN "location" DROP DEFAULT;
ALTER TABLE "Product" ADD COLUMN "location" ...;

The migration should only contain SQL for your actual change (userSession table in this case). If location appears anywhere, delete those lines entirely.

### Step 4: Apply the clean migration:
#### npx prisma migrate dev
This applies only what's pending — your now-clean migration file.


---

---
# What If I am Already in the Error Loop
## If I hit P3006 or P3018 again:

### 1. Find the name of the failed migration
npx prisma migrate status

### 2. Mark it as rolled back (removes the failed flag)
npx prisma migrate resolve --rolled-back "20260516093336_add_user_session_model"

### 3. Delete the bad migration folder
rmdir /s /q "prisma\migrations\20260516093336_add_user_session_model"

### 4. Recreate it cleanly
npx prisma migrate dev --create-only --name "add_user_session_model"

### 5. Inspect and remove any location column SQL
type prisma\migrations\<new_timestamp>_add_user_session_model\migration.sql

### 6. Apply the clean migration
npx prisma migrate dev

### 7. Confirm clean state
npx prisma migrate status

---

---
# Step By Step Production Seed 🚀
## 1. Set Supabase DIRECT_URL

Example:
DIRECT_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres

NOT:
pooler URL
pgbouncer URL

Use:
direct connection.

## 2. Keep DATABASE_URL Optional

For seeding:
DATABASE_URL=pooled-url
DIRECT_URL=direct-url

Fine. My seed prioritizes DIRECT_URL already.

## 3. Run Migrations FIRST 🚨

Before seed:
npx prisma migrate deploy

on production DB.

Otherwise:
tables missing
enums missing
PostGIS columns missing.

## 4. Run Seed
npx prisma db seed

---

<!-- 7. Docker Setup for my app

MIGRATION ERRORS:
  ✅ Migration folder named add_postgis_indexes instead of
     20260327175536_add_postgis_gist_trgm_indexes
     → Prisma could not match it to DB record
     → Fixed: renamed folder with move command

  ✅ P3006: shadow DB failed — location column generated column
     ALTER COLUMN location DROP DEFAULT is wrong syntax
     → Fixed: commented out ALTER COLUMN location lines in migration

  ✅ P3018: failed migration blocking all subsequent migrations
     → Fixed: npx prisma migrate resolve --rolled-back + cleanup

  ✅ Migration drift: 20260327175536 applied to DB but missing locally
     → Fixed: recreated folder with correct timestamp name

  ✅ Double migration created (093336 and 093503 both named same)
     → Fixed: deleted duplicate folders, kept working one

SCHEMA ERRORS:
  ✅ P1012: RefreshToken model referenced in User.refreshTokens
     but model not defined in schema
     → Fixed: model was renamed to userSession — reference updated

  ✅ seed.ts: prisma.refreshToken.deleteMany() — model does not exist
     → Fixed: changed to prisma.userSession.deleteMany()

RUNTIME ERRORS:
  ✅ PrismaClientInitializationError: async buildPrismaClient
     with top-level await incompatible with Turbopack
     → Fixed: replaced with synchronous singleton pattern
     const prisma = globalForPrisma.prisma ?? new PrismaClient()

  ✅ Upstash SDK warnings on startup
     "url property missing or undefined"
     → Fixed: null-guard before initializing Upstash client
     const isUpstash = !!process.env.UPSTASH_REDIS_REST_URL?.length

  ✅ Rate limiter using Upstash in development
     → Fixed: LocalRatelimit class using Docker Redis
     → hasUpstash check: use Upstash in prod, local Redis in dev

PROXY / AUTH ERRORS:
  ✅ Layer 1 per-IP rate limit not running on public auth routes
     login/signup bypassed via PUBLIC_EXACT before Layer 1 ran
     → Fixed: moved Layer 1 before PUBLIC_EXACT check

  ✅ Redundant double token check in isPublicGet block
     if (!token) return; if (token) { — always true
     → Fixed: removed redundant second check

CSP ERRORS:
  ✅ base-url instead of base-uri — invalid directive, browser ignored it
     → Fixed: base-url → base-uri

  ✅ frame-src missing for Razorpay modal
     Razorpay payment modal uses an iframe
     Without frame-src: modal blocked by CSP, payments fail
     → Fixed: added frame-src https://api.razorpay.com https://checkout.razorpay.com

BUILD ERRORS:
  ✅ export function POST = withLogger(...) — syntax error
     Cannot use function keyword with assignment
     → Fixed: export const POST = withLogger(...)

SECURITY GAPS ADDRESSED:
  ✅ JWT none algorithm attack: algorithms not whitelisted
     → Fixed: algorithms: ["HS256"] on all jwt.verify() calls

  ✅ Timing attack on login: instant fail when phone not found
     vs 150ms fail when PIN wrong — reveals valid phones
     → Fixed: DUMMY_HASH — argon2.verify always runs

  ✅ Single rate limiting layer — distributed stuffing bypassed it
     → Fixed: 3 layers (per-IP, per-account, global)

  ✅ Rate limiter in dev hitting Upstash (no credentials)
     → every request logged Rate limiter failed
     → Fixed: local Docker Redis for dev via LocalRatelimit class

  ✅ userSession model missing session tracking fields
     → Fixed: added ipAddress, userAgent, lastSeenIp, lastSeenAt

  ✅ IP change on token refresh not detected or logged
     → Fixed: lastSeenIp comparison on every refresh -->