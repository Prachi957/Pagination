// seed.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Neon/Supabase
});

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home', 'Toys', 'Sports', 'Beauty'];

async function main() {
  console.log('Creating schema...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  console.log('Seeding 200,000 products (bulk insert)...');
  const start = Date.now();

  await pool.query(
    `
    INSERT INTO products (name, category, price, created_at, updated_at)
    SELECT
      'Product ' || i,
      (ARRAY[${CATEGORIES.map((c) => `'${c}'`).join(',')}])[1 + floor(random() * ${CATEGORIES.length})],
      round((random() * 500 + 1)::numeric, 2),
      now() - (random() * interval '365 days'),
      now() - (random() * interval '30 days')
    FROM generate_series(1, 200000) AS i;
    `
  );

  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
