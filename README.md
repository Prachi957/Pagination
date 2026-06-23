# Product Browser API

Browse ~200,000 products, newest first, with category filtering and pagination
that stays correct while products are being added/updated concurrently.

## Stack
- Node.js + Express
- PostgreSQL (tested against Neon free tier)
- No ORM - plain SQL via the `pg` library, so the queries are easy to read and explain
- Plain HTML/JS for the UI (no build step, no framework)

## Setup

1. Create a free Postgres database on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. `npm install`
3. Copy `.env.example` to `.env` and paste your database connection string in.
4. `npm run seed` - creates the schema and inserts 200,000 products in one bulk query (a few seconds).
5. `npm start` - runs the server on `http://localhost:3000`.

## How pagination works (keyset, not OFFSET)

The naive way to paginate is `LIMIT 20 OFFSET 40` ("skip 40 rows, take 20").
The problem: OFFSET skips by *position*. If a row is inserted while a user is
on page 3, everything after it shifts by one position, so the user sees a
duplicate or misses a row entirely. OFFSET also gets slower the deeper you
page, because Postgres still has to scan and discard every skipped row.

This project uses **keyset (cursor) pagination** instead. Each page's request
includes a cursor: the `(created_at, id)` of the last row the client saw.
The next page is fetched with:

```sql
WHERE (created_at, id) < (last_created_at, last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20
```

This asks for rows strictly after a specific *identity*, not a position, so
inserts/updates anywhere else in the table never shift it. It's also fast at
any depth because it's backed by a matching index (see below), so Postgres
jumps straight to that point instead of scanning past skipped rows.

`id` is included alongside `created_at` because many products can share the
same `created_at` - `id` breaks ties and keeps the ordering deterministic.

## Indexes

```sql
CREATE INDEX idx_products_created_id ON products (created_at DESC, id DESC);
CREATE INDEX idx_products_category_created_id ON products (category, created_at DESC, id DESC);
```

The first serves "all products, newest first." The second serves "products
in category X, newest first" directly from the index, without a separate
sort step. Run `EXPLAIN ANALYZE` on `/api/products` queries to see these
indexes being used (look for `Index Scan` instead of `Seq Scan`).

## Verifying correctness under concurrent writes

The UI has a "Simulate 50 new products" button (`POST /api/simulate-writes`).
Start paginating through a category, click the button mid-way, then keep
loading pages. You won't see a duplicate or a missing product - new rows
land relative to their own `created_at`, never shifting the cursor you're
already holding.

## What I'd improve with more time
- Add a total count / "page X of Y" - currently omitted since counting
  200k+ rows on every request is itself a performance trade-off worth
  discussing rather than just adding.
- Add caching (e.g. Redis) for the category list.
- Add rate limiting on `/api/simulate-writes` since it's a public demo endpoint.

## AI usage note
[Fill this in: what you asked AI for, what you changed, what it got wrong.]
