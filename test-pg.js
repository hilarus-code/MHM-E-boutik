import { Pool } from 'pg';
const pool = new Pool();
async function test() {
  try {
    await pool.query('SELECT $1::text', [undefined]);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
