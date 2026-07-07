import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function run() {
  if (!DATABASE_URL) {
    console.log("No DATABASE_URL in environment.");
    return;
  }
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tables = ['brands', 'products', 'variants', 'warehouses', 'suppliers', 'movements', 'sales', 'orders', 'order_items'];
    for (const t of tables) {
      console.log(`--- TABLE ${t} ---`);
      const res = await pool.query(`SELECT * FROM ${t}`);
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (e: any) {
    console.error("Error executing query:", e.message);
  } finally {
    await pool.end();
  }
}

run();
