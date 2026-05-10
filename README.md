# 👗 Fashion E-Commerce Backend

Production-grade single-vendor fashion e-commerce backend built with:

- **Node.js + Fastify** (TypeScript strict mode)
- **PostgreSQL + Prisma ORM**
- **JWT + Argon2id** authentication
- **Cloudflare R2** image storage
- **Razorpay** payments
- **Shiprocket** shipping
- **2factor.in** SMS
- **Railway** deployment ready

---

## 🚀 Quick Start (Windows)

### Prerequisites

| Tool | Version | Download |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| PostgreSQL | 15+ | https://www.postgresql.org/download/windows/ |
| Git | any | https://git-scm.com |

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
# Windows CMD
copy .env.example .env.development

# Windows PowerShell
Copy-Item .env.example .env.development
```

Open `.env.development` and update at minimum:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fashion_ecommerce
JWT_SECRET=any_32+_character_random_string_here
JWT_REFRESH_SECRET=another_32+_character_random_string
PEPPER_SECRET=another_32+_character_random_string_
```

> All other values can remain as placeholders for local development.

### 3. Create the database

```bash
# In PostgreSQL (psql or pgAdmin)
CREATE DATABASE fashion_ecommerce;
```

### 4. Run migrations & seed

```bash
npm run db:migrate:dev   # creates tables
npm run db:generate      # generates Prisma client
npm run db:seed          # seeds admin + sample data
```

### 5. Start the server

```bash
npm run dev
```

Server starts at **http://localhost:3000**

- 📚 Swagger docs: http://localhost:3000/docs
- 🏥 Health check: http://localhost:3000/health

---

## 🔑 Default Credentials (after seed)

| Field | Value |
|-------|-------|
| Email | admin@fashionstore.com |
| Password | Admin@123 |

---

## 📁 Project Structure

```
src/
├── config/         # env, logger, prisma client
├── controllers/    # HTTP layer — parse input, call service, send response
├── services/       # Business logic & orchestration
├── repositories/   # Data access (Prisma queries)
├── routes/         # Fastify route registration + Swagger metadata
├── middlewares/    # authenticate, authorize, errorHandler, requestLogger
├── validators/     # Zod schemas
├── lib/            # errors, response helpers, in-memory cache
└── utils/          # hash, jwt, pagination, slug, orderNumber
```

---

## 🛠️ Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript → dist/ |
| `npm start` | Run compiled production build |
| `npm test` | Run Vitest tests |
| `npm run db:migrate:dev` | Apply migrations (dev) |
| `npm run db:migrate` | Apply migrations (production) |
| `npm run db:seed` | Seed admin + sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset & reseed (dev only!) |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

---

## 🔌 API Overview (`/api/v1`)

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | — | Admin login |
| POST | /auth/refresh | — | Refresh access token |
| POST | /auth/logout | — | Invalidate refresh token |
| POST | /auth/logout-all | ✅ | Revoke all sessions |
| GET | /auth/me | ✅ | Current user info |

### Products
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /products | — | List with filters & pagination |
| GET | /products/:slug | — | Get by slug |
| POST | /products | ADMIN | Create product + variants |
| PATCH | /products/:id | ADMIN/STAFF | Update product |
| DELETE | /products/:id | ADMIN | Soft delete |
| POST | /products/:id/images | ADMIN/STAFF | Upload images (multipart) |
| DELETE | /products/:id/images/:imageId | ADMIN/STAFF | Delete image |

### Cart
| Method | Path | Description |
|--------|------|-------------|
| GET | /cart?customerId=xxx | Get or create cart |
| GET | /cart?sessionId=xxx | Guest cart |
| POST | /cart/:cartId/items | Add item |
| PATCH | /cart/:cartId/items/:variantId | Update quantity |
| DELETE | /cart/:cartId/items/:variantId | Remove item |
| POST | /cart/merge | Merge guest → customer cart |

### Orders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /orders | — | Create order from cart |
| GET | /orders | ADMIN/STAFF | List all orders |
| GET | /orders/:id | — | Get order details |
| PATCH | /orders/:id/status | ADMIN/STAFF | Update status |

### Payments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/orders/:orderId | ✅ | Create Razorpay order |
| POST | /payments/webhook/razorpay | — | Razorpay webhook |

### Inventory
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /inventory/low-stock | ADMIN/STAFF | Low stock alert |
| GET | /inventory/variants/:variantId | ADMIN/STAFF | Get stock |
| PATCH | /inventory/variants/:variantId | ADMIN/STAFF | Update stock |

---

## 💳 Razorpay Integration Flow

```
1. POST /api/v1/orders          → creates order (status: CREATED)
2. POST /api/v1/payments/orders/:orderId  → creates Razorpay order, returns key + razorpayOrderId
3. Frontend opens Razorpay checkout modal
4. On payment success → Razorpay POSTs to /api/v1/payments/webhook/razorpay
5. Webhook verifies HMAC signature → updates order to PAID + deducts stock
```

> In Razorpay dashboard, set webhook URL to:
> `https://your-domain.com/api/v1/payments/webhook/razorpay`

---

## 📦 Order State Machine

```
CREATED → PAYMENT_PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
                         ↘                    ↘
                          FAILED           CANCELLED
                              ↘
                              REFUNDED
```

---

## ☁️ Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project & link
railway new
railway link

# Add PostgreSQL plugin in Railway dashboard
# Then set all env vars from .env.example in Railway dashboard

# Deploy
railway up

# Run migrations on Railway
railway run npx prisma migrate deploy
railway run npx tsx prisma/seed.ts
```

---

## 🔒 Security Features

- ✅ Argon2id password hashing with pepper
- ✅ JWT (15 min access + 7 day refresh tokens)
- ✅ Refresh token rotation & revocation
- ✅ Helmet security headers (CSP, HSTS, etc.)
- ✅ CORS with explicit allowed origins
- ✅ Global rate limiting (100 req/min)
- ✅ Zod input validation on all endpoints
- ✅ Parameterised queries via Prisma (SQL injection protection)
- ✅ Request size limits
- ✅ Razorpay HMAC webhook signature verification
- ✅ Idempotency keys for order creation
- ✅ Soft delete (products, customers)
- ✅ Audit log trail for all mutations
- ✅ Centralized error handler (hides stack traces in production)
- ✅ Centralized Winston logging (JSON in prod, colorized in dev)

---

## 🗄️ Upgrading Cache to Redis

The `src/lib/cache.ts` file uses an in-memory store with a Redis-compatible interface.
To upgrade, replace `InMemoryCache` with an ioredis adapter — no other file needs to change.

```typescript
// Drop-in Redis replacement (example)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export const cache = {
  get: <T>(key: string) => redis.get(key).then(v => v ? JSON.parse(v) as T : null),
  set: <T>(key: string, value: T, ttl = 300) =>
    redis.setex(key, ttl, JSON.stringify(value)),
  del: (key: string) => redis.del(key),
  delPattern: (prefix: string) =>
    redis.keys(`${prefix}*`).then(keys => keys.length ? redis.del(...keys) : 0),
};
```

---

## 🧪 Running Tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

Tests use `fastify.inject()` — no real network calls, no database required for unit tests.

---

## 📬 Postman Quick Test

1. Import the base URL: `http://localhost:3000`
2. Login: `POST /api/v1/auth/login` with `{ "email": "admin@fashionstore.com", "password": "Admin@123" }`
3. Copy the `accessToken` from the response
4. Set header `Authorization: Bearer <token>` for protected routes
5. Browse the Swagger UI at `/docs` for all endpoints with example payloads
