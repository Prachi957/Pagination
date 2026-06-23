// server.js

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Encode a cursor (the last row's created_at + id) into an opaque string
function encodeCursor(row) {
  if (!row) return null;
  const payload = JSON.stringify({ created_at: row.created_at, id: row.id });
  return Buffer.from(payload, 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null; 
  }
}

// GET /api/products?limit=20&category=Books&cursor=<opaque string>
app.get('/api/products', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const category = req.query.category || null;
  const cursor = decodeCursor(req.query.cursor);

  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (cursor && cursor.created_at && cursor.id) {
    params.push(cursor.created_at, cursor.id);
    conditions.push(`(created_at, id) < ($${params.length - 1}, $${params.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);
  const sql = `
    SELECT id, name, category, price, created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT $${params.length}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    const lastRow = rows[rows.length - 1];
    res.json({
      products: rows,
      nextCursor: rows.length === limit ? encodeCursor(lastRow) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/categories - for the filter dropdown
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT category FROM products ORDER BY category'
    );
    res.json(rows.map((r) => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/simulate-writes
app.post('/api/simulate-writes', async (req, res) => {
  const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home', 'Toys', 'Sports', 'Beauty'];
  try {
    await pool.query(
      `
      INSERT INTO products (name, category, price, created_at, updated_at)
      SELECT
        'New Product ' || floor(random() * 1000000)::text,
        (ARRAY[${CATEGORIES.map((c) => `'${c}'`).join(',')}])[1 + floor(random() * ${CATEGORIES.length})],
        round((random() * 500 + 1)::numeric, 2),
        now(),
        now()
      FROM generate_series(1, 50);
      `
    );
    res.json({ ok: true, message: '50 new products inserted with current timestamp.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to simulate writes' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
