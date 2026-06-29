import express from 'express';
import { Pool } from 'pg';
let url = process.env.DATABASE_URL || "";
if (url.startsWith('//')) url = 'postgresql:' + url;
const pool = new Pool({ connectionString: url, ssl: {rejectUnauthorized:false} });
const app = express();
app.get('/test', async (req, res) => {
  try {
    await pool.query('SELECT $1::text', [undefined]);
    res.json({ ok: true });
  } catch (e) {
    console.log("Caught:", e.message);
    res.status(500).json({ error: e.message });
  }
});
const server = app.listen(3001, () => {
  console.log("Listening on 3001");
  fetch('http://localhost:3001/test').then(async r => {
    console.log(r.status, await r.text());
    server.close();
    pool.end();
  });
});
