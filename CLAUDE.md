# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EagleChair is a full-stack B2B e-commerce platform for a premium chair manufacturer. Companies register accounts, browse a product catalog, and submit quote requests. An admin panel allows staff to manage products, companies, quotes, and CMS content.

**Stack:** FastAPI (async) + SQLAlchemy 2.0 + React (Vite) + MySQL (production) / SQLite (tests) / PostgreSQL (local dev option)

## Commands

### Backend

```bash
# Activate virtualenv first
source venv/bin/activate

# Run development server (uvicorn with hot reload)
python -m backend.run

# Run with gunicorn (production-like)
python backend/main.py

# Database migrations (always run from repo root)
alembic upgrade head
alembic revision --autogenerate -m "description"
alembic downgrade -1
```

### Frontend

```bash
cd frontend
npm run dev          # Vite dev server (port 5173)
npm run build        # Build for development
npm run build:production  # Build for production
npm run lint         # ESLint
```

### Testing

```bash
# Run all tests (from repo root, venv active)
pytest

# Run a single test file
pytest tests/test_services/test_auth_service.py

# Run tests by marker
pytest -m unit
pytest -m integration
pytest -m auth
pytest -m products
pytest -m admin

# Run specific test directories
pytest tests/test_services/
pytest tests/test_routes/

# Run without coverage (faster)
pytest --no-cov

# Verbose with print output
pytest -v -s

# Stop on first failure
pytest -x
```

## Architecture

### Backend (`backend/`)

```
backend/
├── main.py              # FastAPI app, lifespan, static file serving, SPA fallback
├── run.py               # Dev server entry point (uvicorn)
├── core/
│   ├── config.py        # Settings via pydantic-settings; loads backend/.env.local > backend/.env.{ENV} > backend/.env
│   ├── security.py      # JWT creation/validation, SecurityManager
│   ├── middleware.py     # CORS, rate limiting, logging, compression setup
│   └── error_handlers.py
├── database/
│   └── base.py          # Async + sync SQLAlchemy engines, Base model, get_db dependency
├── models/              # SQLAlchemy ORM models
│   ├── chair.py         # Chair, Category, Finish, Upholstery, ProductVariation, ProductFamily
│   ├── company.py       # Company (the "user" entity — B2B, no individual users)
│   ├── quote.py         # Quote, QuoteItem
│   ├── content.py       # FAQ, TeamMember, Location, CMS content models
│   └── tmp_catalog.py   # Temporary catalog upload data
├── api/v1/
│   ├── router.py        # Aggregates all route modules
│   └── routes/
│       ├── auth.py          # /auth/* — company registration, login, JWT
│       ├── products.py      # /products/* — public catalog
│       ├── quotes.py        # /quotes/* — quote cart and submission
│       ├── dashboard.py     # /dashboard/* — company dashboard
│       ├── cms_content.py   # /content/* — public CMS reads
│       ├── cms_admin.py     # /cms-admin/* — admin CMS writes + static export
│       ├── content.py       # /content/* — FAQ, team, contact, catalogs
│       ├── seo.py           # /seo/* — sitemap, meta tags
│       └── admin/           # /admin/* — admin-only management routes
│           ├── router.py
│           ├── products.py, companies.py, quotes.py, families.py, ...
└── services/            # Business logic layer
    ├── auth_service.py
    ├── product_service.py   # Product CRUD + fuzzy search + cache warming
    ├── admin_service.py
    ├── cms_admin_service.py # CMS writes + exports content to frontend/dist/data/
    ├── cache_service.py     # Redis-backed YokedCache wrapper
    ├── search_service.py    # Fuzzy search (yokedcache library)
    ├── quote_service.py
    ├── pricing_service.py
    ├── pdf_parser_service.py # Parses product PDFs (PyMuPDF + pdfplumber)
    └── email_service.py     # SMTP via python-jose + Jinja2 templates
```

**Key patterns:**
- All route handlers use `db: AsyncSession = Depends(get_db)` for DB access.
- Services are stateless classes with `@staticmethod` or `@classmethod` methods.
- Prices are stored in cents (integers).
- The `Base` model auto-generates `__tablename__` from the class name (e.g., `Chair` → `chairs`).
- CMS content is written to `frontend/dist/data/contentData.json` at startup and on admin saves, served with no-cache headers.
- On startup, a Redis distributed lock prevents multiple Gunicorn workers from running DB init and CMS export simultaneously.

### Frontend (`frontend/src/`)

```
src/
├── App.jsx              # Router setup (React Router v6)
├── pages/               # One component per route
├── components/
│   ├── admin/           # Admin panel UI
│   ├── layout/          # Header, Footer, Layout wrapper
│   ├── ui/              # Reusable UI primitives
│   ├── quotes/          # Quote cart components
│   └── common/          # Shared components
├── services/            # API call functions (fetch wrappers)
├── contexts/            # React context providers (Auth, Cart, etc.)
├── store/               # State management
├── hooks/               # Custom React hooks
└── config/              # Frontend config (API base URL, etc.)
```

The frontend is served as a SPA by the FastAPI backend in production (catch-all route in `main.py`). In development, Vite runs on port 5173 while the backend runs on port 8000.

### Authentication

Two separate auth flows with distinct JWT token types:
- **Company users**: `type: "company"` tokens, 60-min access / 30-day refresh
- **Admin users**: `type: "admin"` tokens, 30-min access / 1-day refresh

Token type is checked in route dependencies to enforce separation.

### Environment Configuration

Backend reads env files from `backend/` directory in priority order:
1. `backend/.env.local` (highest — local overrides, git-ignored)
2. `backend/.env.{ENVIRONMENT}` (e.g., `.env.development`)
3. `backend/.env`

Key env vars: `DATABASE_URL`, `SECRET_KEY`, `REDIS_URL`, `DEBUG`, `ENVIRONMENT`, `FRONTEND_PATH`

Production requires `DEBUG=false` and non-default `SECRET_KEY` enforced by a Pydantic validator.

### Database

- Alembic migrations live in `backend/alembic/versions/`. Always run migrations from the repo root.
- Tests use SQLite (`sqlite+aiosqlite:///./test.db`) with per-test transaction rollback for isolation.
- Production target is MySQL (aiomysql async driver); local dev supports PostgreSQL (asyncpg).

### Testing

Tests use SQLite in-memory with full transaction rollback between tests (no real DB required). Fixtures in `tests/conftest.py` provide `db_session`, `async_client`, `company_token`, and `admin_token`. Test factories are in `tests/factories.py`. Rate limiting is disabled during tests via `os.environ["RATE_LIMIT_ENABLED"] = "false"` set before app import.
