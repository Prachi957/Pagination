-- schema.sql

DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for "newest first" keyset pagination across ALL products.
CREATE INDEX idx_products_created_id
  ON products (created_at DESC, id DESC);

-- Index for "newest first" keyset pagination WITHIN a category.
CREATE INDEX idx_products_category_created_id
  ON products (category, created_at DESC, id DESC);
