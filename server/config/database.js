import pkg from "pg";
const { Pool } = pkg;

// Schema SQL (moved here for better organization)
const SCHEMA_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
    CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'completed', 'on_hold', 'cancelled');
  END IF;
END$$;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ref_no VARCHAR(100) UNIQUE,
    start_date DATE,
    end_date DATE,
    client VARCHAR(255),
    manager_ids INTEGER[],
    description TEXT,
    tender_value DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    status project_status DEFAULT 'planning'
);

CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phases (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sequence_order INTEGER,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    model VARCHAR(255),
    specifications TEXT,
    unit VARCHAR(50),
    quantity DECIMAL(10,2),
    unit_price DECIMAL(15,2),
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    deadline DATE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shipment_date DATE,
    arrival_date DATE,
    taxes DECIMAL(15,2),
    tracking_no VARCHAR(255),
    contractor VARCHAR(255),
    production_start_date DATE,
    production_end_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    status item_status DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity DEFAULT 'medium',
    is_read BOOLEAN DEFAULT false,
    triggered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(255),
    budgeted_amount DECIMAL(15,2),
    actual_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_items_project_id ON items(project_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_deadline ON items(deadline);
CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
`;

let pool = null;
let isConnected = false;

export const createPool = () => {
  try {
    return new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "zeru",
      password: process.env.DB_PASSWORD || "123",
      port: process.env.DB_PORT || 5432,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
  } catch (error) {
    console.error("Error creating database pool:", error);
    return null;
  }
};

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log("Starting database initialization...");

    // Check if migrations table exists
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'migrations'
      );
    `);

    if (!rows[0].exists) {
      await client.query("BEGIN");

      // Create migrations table if it doesn't exist
      await client.query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          run_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Run the schema SQL
      await client.query(SCHEMA_SQL);

      // Record this initial migration
      await client.query(`
        INSERT INTO migrations (name) VALUES ('initial_schema');
      `);

      await client.query("COMMIT");
      console.log("Database schema initialized successfully");
    } else {
      console.log("Database already initialized, skipping schema creation");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
};

export const connectDB = async () => {
  try {
    console.log("Attempting database connection...");
    console.log(`  User: ${process.env.DB_USER || "postgres"}`);
    console.log(`  Host: ${process.env.DB_HOST || "localhost"}`);
    console.log(`  Database: ${process.env.DB_NAME || "zeru"}`);
    console.log(`  Port: ${process.env.DB_PORT || 5432}`);

    if (!pool) {
      pool = createPool();
      if (!pool) {
        throw new Error("Failed to create database pool");
      }
    }

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();

    // Initialize database schema
    await initializeDatabase();

    isConnected = true;
    console.log("PostgreSQL connected and initialized successfully");
    return true;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    isConnected = false;

    if (pool) {
      try {
        await pool.end();
      } catch (endError) {
        console.error("Error ending pool:", endError);
      }
      pool = null;
    }

    return false;
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error("Database pool not initialized. Call connectDB() first.");
  }
  return pool;
};

export const isDatabaseConnected = () => isConnected;

process.on("SIGINT", async () => {
  if (pool) {
    await pool.end();
    console.log("Database pool closed");
    process.exit(0);
  }
});

export default {
  createPool,
  connectDB,
  getPool,
  isDatabaseConnected,
};
