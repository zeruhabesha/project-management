// database.js

import pkg from 'pg';
const { Pool } = pkg;

let pool = null;
let isConnected = false;

const createPool = () => {
    try {
        return new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'postgres',
            password: process.env.DB_PASSWORD || 'psql',
            port: process.env.DB_PORT || 5432,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            max: 10,
        });
    } catch (error) {
        console.error("Error creating database pool:", error);
        return null; // Return null if pool creation fails
    }
};

export const connectDB = async () => {
    try {
        console.log("Attempting database connection with the following details:");
        console.log(`  User: ${process.env.DB_USER || 'postgres'}`);
        console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
        console.log(`  Database: ${process.env.DB_NAME || 'postgres'}`);
        console.log(`  Port: ${process.env.DB_PORT || 5432}`); // Log port

        if (!pool) {
            pool = createPool();
            if (!pool) {
                throw new Error('Failed to create database pool.'); // Explicit error for pool creation failure
            }
        }

        // Test the connection with a simple query
        const client = await pool.connect();
        console.log("Database connection test successful!");
        await client.query('SELECT NOW()');
        client.release();

        console.log('PostgreSQL connected successfully');
        isConnected = true;
        return true;
    } catch (error) {
        console.warn('Database connection failed:', error.message);
        console.warn('Connection Details:', {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'postgres',
            port: process.env.DB_PORT || 5432,
        });

        isConnected = false;

        // Clean up the pool if connection failed
        if (pool) {
            try {
                await pool.end();
            } catch (endError) {
                console.error("Error ending pool during connection failure:", endError);
            }
            pool = null;
        }

        return false;
    }
};

export const getPool = () => {
    if (!pool) {
        pool = createPool();  //Try creating the pool again
        if (!pool) {
            throw new Error('Database pool is null or undefined.  Check connection settings.');
        }
    }
    if (!isConnected) {
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