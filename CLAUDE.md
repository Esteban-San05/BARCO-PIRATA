# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Dev server on http://localhost:3000
npm run build        # TypeScript check + Vite production build
npm run type-check   # tsc --noEmit only
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:watch   # Vitest interactive
npm run test:coverage # Vitest + coverage report
npm run preview      # Preview production build
```

Tests live in `src/utils/` only. Run a single file: `npx vitest run src/utils/validators/reservation.test.ts`.

### Environment setup

Copy `.env.example` → `.env.local` and fill:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_API_URL=/api          # default
VITE_APP_ENV=development
```

To regenerate Supabase TypeScript types after schema changes:
```bash
npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
```

---

## Architecture

**Stack:** React 18 + Vite + TypeScript (strict) + Tailwind CSS + Supabase + Stripe + React Query v5 + Zustand + i18next.

### State model

| Concern | Tool |
|---|---|
| Server data (reservations, payments, reports) | **React Query** — hooks in `src/features/*/hooks/` with queryKey factories |
| Client/UI state (pending reservation, selected date) | **Zustand** — `src/app/store/reservationStore.ts` |
| Form state | **React Hook Form + Zod** |

### Vertical slice structure

`src/features/` groups code by domain, not by file type:

```
src/features/
  auth/           # useAuth hook, AuthUser type
  reservations/   # useReservations, useCreateReservation, useCancel...
  payments/       # usePayments, useProcessPayment, useCreateStripeIntent, receiptService
  reports/        # reportService (Excel/PDF via jsPDF/xlsx)
  availability/   # useAvailability
  settings/       # useBusinessSettings, settingsService
```

Each feature contains `hooks/`, `services/`, and optionally `types/`. Primitive UI components live in `src/components/ui/`; page-level components are in `src/pages/`.

### Routing

Public pages wrap in `PublicLayout` (header + footer). Admin pages wrap in `ProtectedRoute → AdminLayout`. All pages are lazy-loaded.

**Public routes:** `/`, `/reservar`, `/reservar/confirmacion`, `/clima`, `/pago/:reservationId`, `/recibo/:reservationId`

**Admin routes (auth required):** `/admin/login`, `/admin`, `/admin/reservaciones`, `/admin/venta/:reservationId`, `/admin/reportes`, `/admin/ajustes`, `/admin/horarios`, `/admin/bitacora`, `/admin/respaldo`

### Path aliases

Configured in both `tsconfig.app.json` and `vite.config.ts`:

```
@/*          → src/*
@components/* → src/components/*
@features/*  → src/features/*
@hooks/*     → src/hooks/*
@lib/*       → src/lib/*
@pages/*     → src/pages/*
@services/*  → src/services/*
@app-types/* → src/types/*
@utils/*     → src/utils/*
@constants/* → src/constants/*
@assets/*    → src/assets/*
@app/*       → src/app/*
```

### Key singleton files

| File | Purpose |
|---|---|
| `src/constants/index.ts` | All business rules: PACKAGES, TIME_SLOTS, BOAT_CAPACITY (40), MAX_ADVANCE_DAYS (90), DISCOUNT_MIN_PEOPLE (5), DISCOUNT_RATE (10%), ROUTES |
| `src/types/index.ts` | Shared domain types: Reservation, Payment, User, DTOs, BusinessSettings |
| `src/lib/supabase/client.ts` | Supabase singleton (auto-refresh session, detect session in URL) |
| `src/lib/axios/index.ts` | Axios instance — auto-injects JWT from Supabase Auth, 401 → logout |
| `src/lib/i18n/index.ts` | i18next config (auto-detects language, falls back to `es`) |
| `src/utils/validators/reservation.ts` | Zod reservation schema — built dynamically to embed i18n error messages |

### Design system

Tailwind palette is defined in `tailwind.config.ts`:
- **Navy** (`navy-*`) — dark blue foundation (~70% of UI)
- **Gold** (`gold-*`) — amber/golden accents, CTAs, active states (~20%)
- **Pirate** (`pirate-*`) — red for danger/errors (≤10%)
- Fonts: `Inter` (sans-serif default), `Cinzel` (`font-display` / `font-display-deco`), `Pirata One` (`font-pirata`)

Global component classes (`.card`, `.panel-gold`, `.panel-dark`, `.btn-primary`, `.btn-accent`, etc.) are defined in `src/styles/globals.css`.

Hero animated scene styles (ship bob, waves, seagulls, smoke, carousel) are isolated in `src/styles/hero.css`.

### i18n

Translation keys live in `src/lib/i18n/locales/es/common.json` and `en/common.json` — both files must always have the same keys. Admin pages are Spanish-only (no i18n). Use the `useTranslation()` hook throughout public pages.

### Security layers

- Supabase Row-Level Security (RLS) enforces data access at the DB level
- Stripe secret key is server-side only via Supabase Edge Functions (`supabase/functions/create-payment-intent`)
- `src/utils/security/sanitize.ts` wraps DOMPurify for any user-generated content
- Audit log table (`audit_log`) captures user, IP, and old/new values for admin actions

### Build output

Vite is configured with manual chunks to split vendor code: `stripe`, `query`, `ui`, `export`, `router`, `vendor`. This keeps initial bundle small. Port is hard-coded to `3000`.
