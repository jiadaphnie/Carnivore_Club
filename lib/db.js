const { neon } = require('@neondatabase/serverless');

function database() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

async function query(statement, parameters = []) {
  return database().query(statement, parameters);
}

module.exports = { query };