# Harvest Rentals

Harvest Rentals is a mobile-first web app that helps farmers find and book
harvesting machines near their village, and helps machine owners manage their
machines and booking requests.

The app is a React + TypeScript single-page app backed by Supabase
(PostgreSQL, Auth, Storage, Realtime). The UI is available in English,
Kannada, and Hindi.

## What it does

**Farmers**
- Create an account with an email and password, then pick the farmer account
  type.
- Search active machines by village, optionally filter by crop or machine type,
  and sort by distance when location is available.
- See machine details, price per acre, service villages, supported crops,
  owner contact links, and upcoming unavailable dates.
- Request a single-day booking with village, acreage, crop, contact phone, and
  an optional note.
- Track bookings in realtime, cancel pending or confirmed bookings, and call or
  message the owner.

**Machine owners**
- Create an account with an email and password, then pick the owner account
  type.
- Add and edit machines, including model, price per acre, crops, service
  villages, contact phone, optional GPS coordinates, and one photo.
- Pause or reactivate a machine without deleting its history.
- Accept or reject pending requests, optionally with a note.
- Mark specific dates unavailable and review all bookings.
- See new requests and booking updates in realtime.

Account types are selected once and then locked, so a farmer account cannot
silently become an owner account (or the reverse). This is enforced in the UI
and in the database.

## Tech stack

- React 19, TypeScript 5.9, Vite 7
- Tailwind CSS 4 (CSS-first design tokens)
- React Router 7
- Supabase JS 2 (Auth, Postgres, Storage, Realtime)
- Lucide icons
- Vitest + Testing Library + jsdom
- ESLint 9 + typescript-eslint

## Getting started

### 1. Prerequisites

- Node.js 20 or newer (developed with Node 24)
- npm
- A Supabase project (the free plan is enough; no paid services are required)

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

Copy `.env.example` to `.env` and fill in the public client values from your
Supabase project (Project Settings > API):

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Only the anon public key belongs in this file. Never put the service-role key
in a Vite environment variable or any browser bundle.

### 4. Apply the database migrations

Apply the migration files in `supabase/migrations/` **in filename order**:

1. `20260101000000_schema.sql` — Enums, tables, indexes, triggers, and base `machine_cards` view.
2. `20260101000100_functions.sql` — Auth triggers, user role management, and booking RPCs.
3. `20260101000200_rls.sql` — Row Level Security and least-privilege table grants.
4. `20260101000300_storage.sql` — Public `machine-images` storage bucket and folder policies.
5. `20260101000400_realtime.sql` — Enables Realtime publications for bookings and notifications.
6. `20260101000500_live_tracking.sql` — GPS live tracking table and permissions.
7. `20260101000600_two_way_tracking.sql` — Bidirectional location tracking (farmer + owner).
8. `20260101000700_delete_machine.sql` — Machine deletion policy for machine owners.
9. `20260101000800_platform_stats.sql` — Safe public platform statistics RPC (`get_platform_stats`).
10. `20260101000900_delete_machine_rpc.sql` — Atomic cascade deletion RPC for machine listings.
11. `20260101001000_optimized_search_machines.sql` — Single round-trip ranked machine search RPC.
12. `20260101001100_features_and_security_hardening.sql` — Extended crop catalog (20 crops), avatars bucket, work status, machine waitlist, 'My Record' analytics, and security hardening.
13. `20260101001200_enforce_deleted_machine_consistency.sql` — Bulletproof machine deletion, strict active machine filtering in `machine_cards`, inactive check in `create_booking`, and Realtime synchronization.

#### Deployment Options:

**Option A: Supabase CLI (Recommended)**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B: Dashboard SQL Editor**
Run each migration file from `supabase/migrations/` sequentially in the Supabase SQL editor.

> [!NOTE]
> **Standalone SQL Scripts in `supabase/`**:
> The standalone `.sql` files at the root of `supabase/` (`all_in_one_setup.sql`, `fix_bookings.sql`, `more_crops.sql`, `work_status.sql`, `avatars.sql`, `record.sql`, `security_hardening.sql`, and `allow_booking_after_completion.sql`) are legacy standalone utility scripts and one-time patch files. They are preserved for reference, but running the sequential migration chain (`20260101000000` through `20260101001100`) is the canonical, complete, and reproducible setup path for both new and existing environments. If you want sample data, `supabase/seed_machines.sql` can optionally be applied afterwards.

### 5. Enable email/password sign-in

The app uses Supabase's built-in email/password auth. This is free and needs no
Google Cloud project, no SMS provider, and no credit card.

In the Supabase Dashboard:

1. Go to **Authentication > Providers > Email** and keep **Enable Email
   provider** turned on.
2. For the simplest free setup, turn **Confirm email** off. New accounts are
   then usable immediately and Supabase does not send any email.
3. If you leave confirmation on, users must click the confirmation link before
   signing in. The app handles this and shows a "check your email" screen.
4. Under **Authentication > URL Configuration**, set the Site URL to
   `http://localhost:5173` for local development, and add your production URL
   when you deploy.

No custom SMTP server is required while email confirmation is disabled.

**Forgot password:** the sign-in page has a "Forgot password?" link that emails
a reset link. For it to work, add `http://localhost:5173/reset-password` (and
your production `/reset-password` URL) under **Authentication > URL
Configuration > Redirect URLs**. Supabase's free email service has rate limits
and may require a custom SMTP provider for heavier use.

### 6. Run the app

```bash
npm run dev
```

Open `http://localhost:5173`.

If the Supabase values are missing or still placeholders, the app shows a
configuration screen instead of failing with a blank page.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript project checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Project structure

```text
src/
  auth/          AuthProvider, route guards, redirect helpers, language sync
  components/    Shared UI, layout, brand, booking, contact, machine components
  hooks/         useAsync, useGeolocation, useNotifications
  i18n/          English source dictionary + Kannada/Hindi translations
  lib/           Env, Supabase client, validation, errors, formatting, labels
  pages/         Route pages (auth, farmer, owner, settings)
  services/      Supabase data access and RPC wrappers
  test/          Vitest setup
  types/         Shared TypeScript types
supabase/
  migrations/    Schema, functions, RLS, storage, realtime
```

## Data and security model

- **No contact details in profiles.** Profiles store a display name, role,
  language, and village/district/state. Email and phone are not duplicated
  there. The email lives only in Supabase's protected `auth.users` table.
- **Machine phone** is a business contact stored on `machines`. **Booking
  phone** is stored on `bookings`. Contact happens through `tel:` and WhatsApp
  links; the app does not send SMS or email.
- **Bookings are RPC-only.** Direct table inserts/updates are not granted.
  `create_booking`, `respond_to_booking`, and `cancel_booking` enforce
  ownership, status transitions, blackout dates, paused machines, and
  duplicate/overlapping requests.
- **One confirmed booking per machine per day** and **one pending request per
  farmer per machine per day** are enforced with partial unique indexes.
- **Owners write service villages only through `set_machine_locations`**, so a
  machine always has exactly one primary village.
- **RLS** restricts profiles, machines, machine locations, blackout dates,
  bookings, and notifications to signed-in users with a legitimate
  relationship to the row. Anonymous users get no table access.
- **Photos** live in the public `machine-images` bucket. Uploads are limited to
  5 MB and JPEG/PNG/WebP, and writes are restricted to the signed-in user's
  `${auth.uid()}/...` folder.
- **No fake data.** Empty states and errors are real; the app never ships
  invented listings, reviews, or statistics.
- **No payments or reviews** are implemented. A booking is a request plus
  owner confirmation; payment and final pricing happen directly between the
  two parties.

## Internationalization

`src/i18n/en.ts` is the source of truth. `kn.ts` and `hi.ts` are typed as
`Record<TranslationKey, string>`, so TypeScript fails if a key is missing.
Login-screen strings live in `src/i18n/auth.ts` with the same parity check.
Language is saved in local storage and, when the user is signed in, to the
profile. Dates and currency use `Intl` with `en-IN`, `kn-IN`, and `hi-IN`.

## Deployment

1. Build with `npm run build`.
2. Deploy `dist/` to any static host.
3. Configure an SPA fallback so all routes serve `index.html`:
   - Vercel: rewrite `/(.*)` to `/index.html`
   - Netlify: `/* /index.html 200`
4. Add the production URL to the Supabase **Site URL** and redirect allowlist.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's build
   environment.

The Supabase anon key is safe to expose; security depends on RLS and grants,
not on hiding it.

## Verification status

Verified in this workspace:

- `npm run typecheck` passes.
- `npm run lint` passes with no errors (only `react-refresh` warnings for
  files that intentionally export non-components alongside components).
- `npm test` passes 24 tests across validation, error mapping, and translation
  parity.
- `npm run build` produces a production bundle.

Not verified here: this environment had no Supabase CLI or Docker, so the SQL
migrations, RLS policies, storage policies, and Realtime publication have
**not** been executed against a live backend. Apply the migrations as described
above, verify email/password sign-up in the Supabase Dashboard, and smoke-test
both account types before deploying.

## Known limitations

- Bookings are for a single day and a single machine; there is no multi-day or
  multi-machine cart.
- No online payments, invoices, reviews, or ratings.
- Machine photos are optional; a designed placeholder is shown otherwise.
- Location is optional. Distance sorting requires browser permission; village
  search works without it.
- Login is email/password only. Phone OTP, Google sign-in, and social login
  are not implemented.
- There are no end-to-end browser tests. The automated suite covers pure logic
  and translation integrity.
