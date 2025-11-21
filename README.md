# StockSavvy2

StockSavvy2 is a full-stack inventory, sales, and forecasting dashboard built with Django/CDK REST APIs and a React/Vite frontend. It pairs a Django 5.2 REST backend (custom user model, PostgreSQL, Django Q for background jobs) with a React 18 SPA that consumes those APIs via Axios + TanStack Query. The product focuses on inventory health, sales tracking, predictive demand, and supplier restock coordination.

## Architecture Overview

- **Backend** – Located under `backend/`, it exposes REST endpoints via `api/` using Django REST Framework. The app ships with a custom `User` model, transactional serializers (products, restock rules, sales, activities, forecasts), low-stock notification logic, and forecast generation powered by Prophet & pandas. Background scheduling relies on Django Q (Redis), with ready-to-use management commands for forecasts, exports, cleanup, and task setup.
- **Frontend** – Found in `frontend/client/`, this Vite-based SPA uses React 18, Wouter for routing, TanStack Query for data fetching, and a Radix/shadcn-inspired UI kit in `components/`. Authentication is handled with a very lightweight token (`token_{user.id}`) stored in `localStorage`, and the UI contains pages for dashboard metrics, inventory, sales, reports, analytics, forecasts, and user management.
- **Deployment** – Static assets are collected into Django via Whitenoise. `render.yaml` describes how Render.com builds the project: install Python/Node deps, build the frontend, run Django migrations, collect static files, and launch Gunicorn.

## Getting Started

### Prerequisites

1. Install Python 3.11+, Redis (for Django Q), and PostgreSQL.
2. Install Node.js 18+ (to match the `NODE_VERSION` in `render.yaml`).
3. Optional: install Poetry (`pip install poetry`) since the backend is declared via `pyproject.toml`.

### Environment variables

| Name | Purpose | Default / Notes |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Django secret key | fallback `your-secret-key-here` |
| `DATABASE_URL` | PostgreSQL connection string | Supabase URL preconfigured in `backend/backend/settings.py` |
| `DEBUG` | Toggles Django debug mode | `"False"` in production |
| `GCS_BUCKET_NAME` | (Optional) bucket for `api.tasks.backup_data` | defaults to `'your-bucket-name'` |
| `VITE_API_URL` | Frontend → backend base URL | `http://localhost:8000` |

### Backend setup (from project root)

```bash
cd backend
poetry install
# create a `.env` with the variables above (Poetry + python-dotenv are already configured)
poetry run python manage.py migrate
poetry run python manage.py createsuperuser  # or use `create_admin` command
poetry run python manage.py setup_tasks       # schedules Django Q jobs
poetry run python manage.py runserver 0.0.0.0:8000
```

Tip: `setup_tasks` registers the forecast, low-stock alert, and backup jobs described in `api/tasks.py`. You can trigger forecasting manually via `poetry run python manage.py generate_forecasts` after seeding sales data.

### Frontend setup

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev -- --host
```

You can also set `VITE_API_URL` in `.env` files (leveraging Vite’s `import.meta.env`). The SPA persists the bearer token + user in `localStorage`, and axios interceptors redirect to `/login` on 401s.

### Combined workflow

Windows helpers `start_stocksavvy.bat` and `start_stocksavvy_advanced.bat` exist in the repo root if you prefer double-click launches. They spin up backend/frontend in parallel and open `http://localhost:5173`.

## Key Domain Features

- **Inventory & Categories** – `InventoryPage` exposes tabs for product list, add/edit product form (with outlier price checks), restock rules, and product batches. Products/categories have Django validators, SKU standards, and intentional `auto-generated SKU` guards inside `ProductSerializer`.
- **Sales + Receipts** – Users submit sales with items, discounts, and user links. Sales endpoints return timezone-aware data (Nairobi) and the frontend renders receipts via `Receipt.tsx` / `ReceiptDialog.tsx`.
- **Forecasting pipeline** – `generate_forecasts` management command (Prophet + pandas) captures 90 days of history, forecasts 30 days ahead, and writes to `ProductForecast`. Forecast endpoints such as `/api/products/<id>/forecasts/` and `/api/forecasts/` are consumed by `ForecastsPage`.
- **Background jobs** – `api/tasks.py` registers three Django Q jobs: forecast generation (daily 1 AM), low-stock checks (every six hours, sending supplier emails), and placeholder backups to GCS. Requirements include an accessible Redis server (`127.0.0.1:6379` in config).
- **Analytics & Reports** – The backend exposes reporting actions under `ReportViewSet` (`inventory`, `sales_chart`, `profit`, `stats`, `category_chart`, `top_products`). Dashboard components (`CategoryChart`, `SalesChart`, `LowStockTable`, `RecentActivityTable`, `StatCard`) consume these endpoints via `api/lib/queryClient`.
- **User management** – `UserViewSet` supports login/logout actions, token creation, and permission gating (admin/manager) via decorated viewset logic.

## API Surface (highlights from `backend/api/urls.py`)

- `/api/users/` – CRUD plus `login`/`logout`.
- `/api/categories/`, `/api/products/`, `/api/sales/`, `/api/activities/`, `/api/restock-rules/`, `/api/analytics/`, `/api/reports/`, `/api/sales-items/`
- `/api/product-batches/`, `/api/batch-sale-items/` (batch inventory tracking).
- Special endpoints: `/api/products/low-stock/`, `/api/reports/profit/`, `/api/reports/inventory/`, `/api/reports/sales/`, `/api/dashboard/...`, `/api/products/<id>/reorder/`, `/api/products/<product_id>/forecasts/`, `/api/forecasts/`.
- There is also a plain `test/` view for health checks.

## Production & Deployment Notes

- Render build steps (see `render.yaml`): install Python & Node deps, `npm run build`, Django migrations, `collectstatic`, then run `gunicorn backend.wsgi:application`.
- Whitenoise serves the static assets compiled under `frontend/client/dist/public`, which is wired in `backend/backend/settings.py` via `STATICFILES_DIRS`.
- Keep `DEBUG=False`, set `SECRET_KEY`, `DATABASE_URL`, and ensure Redis + PostgreSQL endpoints are reachable from the host.

## Useful Scripts & Management Commands

- `python manage.py generate_forecasts` – builds product-level forecasts using Prophet and saves them to `ProductForecast`.
- `python manage.py clear_forecasts` – removes forecast rows when schedules should rebuild from scratch.
- `python manage.py cleanup_sale_items` – removes orphaned sale items (used after imports/tests).
- `python manage.py export_products` – dumps `products_export.csv`.
- `python manage.py create_admin` – seeded admin user helper.
- `python manage.py setup_tasks` – registers Django Q job schedules.

## Frontend tooling

- Vite + TypeScript, React 18, Wouter router, TanStack Query, and an in-house UI library in `components/ui`.
- Axios clients (`lib/api.ts`) centralize token handling, 401 redirects, and paginated helpers.
- `lib/auth.tsx` provides `AuthProvider`, `useAuth`, and `ProtectedRoute` patterns.
- `services/batch.service.ts` and `types/` bundles keep model interactions typed.

## Next Steps

- Seed PostgreSQL with categories, products, and sales (CSV imports or manual entry) before generating forecasts.
- Wire up Redis and run `setup_tasks` so autoscheduling works.
- For production, ensure `VITE_API_URL` points to the deployed Django host and rebuild the frontend (`npm run build`) before running `collectstatic`.

