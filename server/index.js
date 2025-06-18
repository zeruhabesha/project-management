// app.js (Main application)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import cron from 'node-cron';

import { connectDB, isDatabaseConnected } from './config/database.js';
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import itemRoutes from './routes/items.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import { checkDeadlines } from './services/alertService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database connection and THEN setup routes
(async () => {
    try {
        const connected = await connectDB();
        if (!connected) {
            console.error('Failed to connect to the database. Exiting.');
            process.exit(1); // Exit the application if the database connection fails
        }

        console.log('Database initialized successfully');

        // Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/projects', projectRoutes);
        app.use('/api/items', itemRoutes);
        app.use('/api/users', userRoutes);
        app.use('/api/reports', authenticateToken, reportRoutes);

        // Health check
        app.get('/api/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                database: isDatabaseConnected() ? 'connected' : 'disconnected',
                mode: isDatabaseConnected() ? 'database' : 'mock'
            });
        });

        // Error handling
        app.use(errorHandler);

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
            process.exit(0);
        });

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Database status: ${isDatabaseConnected() ? 'connected' : 'disconnected'}`);
            if (!isDatabaseConnected()) {
                console.log('Note: To use full database features, ensure PostgreSQL is running on localhost:5432');
            }

            // Only set up cron jobs if database is connected
            if (isDatabaseConnected()) {
                cron.schedule('0 9 * * *', () => {
                    console.log('Running daily deadline check...');
                    try {
                        checkDeadlines();
                    } catch (error) {
                        console.error('Error running deadline check:', error);
                    }
                });
            } else {
                console.warn("Cron job for deadline checks is disabled because the database is not connected.");
            }
        });
    } catch (error) {
        console.error('Application startup error:', error);
        process.exit(1);
    }
})();