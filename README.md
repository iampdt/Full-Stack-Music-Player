# Full Stack Music Player

A Spotify-inspired full stack music app built with Next.js App Router, Supabase, and Stripe.

This project supports:

- Public song discovery
- Auth-gated playback
- Premium-gated uploads
- Subscription billing with Stripe
- Liked songs per user
- Runtime auth provider controls (Google, Apple, and GitHub)

## Table of Contents

- Project Overview
- Core Features
- Tech Stack
- Architecture
- Data Model
- Environment Variables
- Local Development
- Stripe Setup
- Supabase Setup
- Scripts
- Deployment (Vercel)
- Troubleshooting
- Security Notes

## Project Overview

This app provides a full music product flow:

- Guests can browse catalog entries
- Users must be logged in to play songs
- Users can like songs and manage their own library
- Premium users can upload songs and cover images
- Billing and plan status are managed with Stripe and synchronized to Supabase

## Core Features

### Authentication

- Email/password login via Supabase Auth UI
- Optional social login toggles for Google, Apple, and GitHub
- Auth modal opens for protected actions (for example, Liked Songs)

### Music Experience

- Persistent player with play/pause, next/previous, and volume controls
- Hover play button on song cards triggers direct playback
- Liked songs playlist per authenticated user

### Premium and Billing

- Stripe Checkout session flow
- Optional Stripe Payment Link flow
- Stripe Customer Portal integration for subscription management
- Webhook-driven product/price/subscription sync
- Fallback subscription synchronization endpoint to recover from delayed/missed webhooks

### Upload and Library

- Premium-only upload modal
- MP3 and image upload to Supabase Storage
- Automatic user profile existence check before song insert to avoid foreign key issues

### Catalog Seeding

- Utility scripts for DB reset and seed
- Catalog sync tooling for Stripe products/prices
- Script to seed 50 real tracks for shared catalog use

## Tech Stack

- Framework: Next.js 13.4.4 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Auth and Database: Supabase
- Storage: Supabase Storage
- Billing: Stripe
- State Management: Zustand
- Forms: React Hook Form
- Notifications: react-hot-toast
- Audio playback: use-sound

## Architecture

### Frontend

- App Router pages under app/
- Shared UI components under components/
- Client hooks for player, auth modal state, and user state under hooks/

### Backend (within Next.js)

- Route handlers under app/api/ for checkout, portal, webhooks, user ensure, and subscription sync
- Supabase admin helper layer under libs/
- Server actions for fetching songs, liked songs, and active products/prices under actions/

### Providers

- Supabase session provider
- User context provider
- Global modal provider (auth, subscribe, upload)
- Toast provider

## Data Model

Important tables in Supabase:

- users
- songs
- liked_songs
- products
- prices
- customers
- subscriptions

Storage buckets:

- songs (audio files)
- images (cover art)

## Environment Variables

Copy values from .env.example into your local .env.local.

Required core variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional variables:

```env
SUPABASE_DB_URL=
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=
STRIPE_WEBHOOK_SECRET_LIVE=
NEXT_PUBLIC_VERCEL_URL=
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false
NEXT_PUBLIC_ENABLE_APPLE_AUTH=false
NEXT_PUBLIC_ENABLE_GITHUB_AUTH=false
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Start development server:

```bash
npm run dev
```

4. Open:

http://localhost:3000

If the local Next.js cache gets stale, use:

```bash
npm run dev:fresh
```

## Stripe Setup

1. Create products and recurring prices in Stripe Dashboard (test mode for local).
2. Configure webhook endpoint to point to /api/webhooks.
3. Store webhook secret in STRIPE_WEBHOOK_SECRET.
4. Optionally run local webhook forwarding:

```bash
npm run stripe:listen
```

5. Validate and sync catalog:

```bash
npm run stripe:doctor
```

## Supabase Setup

1. Create project and set URL and keys in env variables.
2. Ensure tables match type_db.ts schema.
3. Ensure buckets exist and are accessible for app flow:
	- songs
	- images
4. Configure Auth providers in Supabase Dashboard:
	- Enable Google if using NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true
	- Enable Apple if using NEXT_PUBLIC_ENABLE_APPLE_AUTH=true
	- Enable GitHub if using NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true
5. Configure Auth URL settings (Site URL and redirect URLs) for your local and deployed domains.

## Scripts

Available npm scripts:

- npm run dev
- npm run dev:clean
- npm run dev:fresh
- npm run build
- npm run start
- npm run lint
- npm run db:reset:seed
- npm run stripe:check
- npm run stripe:sync:catalog
- npm run stripe:doctor
- npm run stripe:listen

## Deployment (Vercel)

1. Connect repository to Vercel.
2. Add all required environment variables in Vercel Project Settings.
3. Ensure variables are set for the correct scope:
	- Production
	- Preview (if needed)
4. Deploy from main.

Important:

- Vercel does not read your local .env.local automatically.
- After adding missing env vars, trigger a fresh redeploy.
- If a deployment failed due to env mismatch, redeploy once with cache disabled.

## Troubleshooting

### Build error: supabaseUrl is required

- Cause: NEXT_PUBLIC_SUPABASE_URL missing in Vercel environment for the target scope.
- Fix: add NEXT_PUBLIC_SUPABASE_URL and redeploy.

### No active plan after successful Stripe payment

- Cause: Stripe customer mapping mismatch or delayed webhook.
- Fix: use /api/sync-subscription fallback flow and verify customer mapping in customers table.

### Upload fails with songs_user_id_fkey

- Cause: user row missing in public.users.
- Fix: ensure-user route and user backfill logic are included and deployed.

### Google login button does not appear

- Verify NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true in frontend env.
- Verify Supabase external.google is enabled.
- Verify redirect URLs and OAuth app callback settings.

### GitHub login button does not appear

- Verify NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true in frontend env.
- Verify Supabase external.github is enabled.
- Verify redirect URLs and GitHub OAuth app callback settings.

## Security Notes

- Never commit real secrets.
- Rotate secrets immediately if exposed:
  - SUPABASE_SERVICE_ROLE_KEY
  - STRIPE_SECRET_KEY
  - STRIPE_WEBHOOK_SECRET
- Keep production and test Stripe keys strictly separated.

