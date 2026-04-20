# Full Stack Music Player

A Spotify-inspired full stack music app built with Next.js App Router, Supabase, and Stripe.

This project supports:

- Public song discovery
- Auth-gated playback
- Premium-gated uploads
- Subscription billing with Stripe
- Liked songs per user
- Runtime auth provider controls (Google and GitHub)

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
- Free Tier Warmup Automation
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

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
.env.local
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




