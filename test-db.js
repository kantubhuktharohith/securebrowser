import pg from 'pg';
const { Pool } = pg;

const passwords = [
  'root',
  'root123',
  'Asus',
  'asus',
  'asus123',
  '12345',
  '12345678',
  '123456789',
  'secureexam',
  'postgre',
  'postgresql',
];

async function run() {
  for (const pw of passwords) {
    const conn = `postgresql://postgres:${pw}@127.0.0.1:5432/postgres`;
    try {
      console.log(`Trying postgres:${pw}...`);
      const pool = new Pool({ connectionString: conn });
      const client = await pool.connect();
      console.log(`SUCCESS with postgres:${pw}!`);
      const res = await client.query('SELECT version();');
      console.log('Version:', res.rows[0]);
      client.release();
      await pool.end();
      process.exit(0);
    } catch (e) {
      console.log(`Failed for postgres:${pw}:`, e.message);
    }
  }
  
  // Try connecting as "Asus" with same passwords
  for (const pw of passwords) {
    const conn = `postgresql://Asus:${pw}@127.0.0.1:5432/postgres`;
    try {
      console.log(`Trying Asus:${pw}...`);
      const pool = new Pool({ connectionString: conn });
      const client = await pool.connect();
      console.log(`SUCCESS with Asus:${pw}!`);
      const res = await client.query('SELECT version();');
      console.log('Version:', res.rows[0]);
      client.release();
      await pool.end();
      process.exit(0);
    } catch (e) {
      console.log(`Failed for Asus:${pw}:`, e.message);
    }
  }
  process.exit(1);
}

run();
