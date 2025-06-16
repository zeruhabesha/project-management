import pkg from 'pg';
const { Pool } = pkg;

let pool = null;
let isConnected = false;

const createPool = () => {
  return new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'project_management',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    // Add connection timeout and retry settings
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
};

export const connectDB = async () => {
  try {
    if (!pool) {
      pool = createPool();
    }
    
    // Test the connection with a simple query
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('PostgreSQL connected successfully');
    isConnected = true;
    return true;
  } catch (error) {
    console.warn('Database connection failed:', error.message);
    console.warn('Application will continue without database connection');
    isConnected = false;
    
    // Clean up the pool if connection failed
    if (pool) {
      try {
        await pool.end();
      } catch (endError) {
        // Ignore errors when ending the pool
      }
      pool = null;
    }
    
    return false;
  }
};

export const getPool = () => {
  if (!isConnected || !pool) {
    throw new Error('Database not connected');
  }
  return pool;
};

export const isDatabaseConnected = () => isConnected;

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    try {
      await pool.end();
      console.log('Database pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error);
    }
  }
});

export { pool };