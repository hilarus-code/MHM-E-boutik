import { Pool } from 'pg';
let url = process.env.DATABASE_URL || "";
if (url.startsWith('//')) url = 'postgresql:' + url;
const pool = new Pool({ connectionString: url, ssl: {rejectUnauthorized:false} });
async function run() {
  try {
    await pool.query('SELECT * FROM products WHERE id = $1', [undefined]);
  } catch (e) {
    console.log('Error:', e.message);
  } finally { pool.end(); }
}
run();
