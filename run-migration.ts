import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Please add it to your environment variables.");
    process.exit(1);
  }

  if (connectionString.startsWith('//')) {
    connectionString = 'postgresql:' + connectionString;
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log("Connected to database successfully.");

    const sqlFilePath = path.join(process.cwd(), 'supabase-schema.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log("Executing schema script...");
    await client.query(sql);
    
    console.log("Schema applied successfully.");
  } catch (error) {
    console.error("Error executing schema:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
