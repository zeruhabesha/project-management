import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import cron from "node-cron";

import { connectDB, isDatabaseConnected } from "./config/database.js";
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import itemRoutes from "./routes/items.js";
import userRoutes from "./routes/users.js";
import reportRoutes from "./routes/reports.js";
import { checkDeadlines } from "./services/alertService.js";

// Load environment variables first
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(compression());
app.use(morgan("dev")); // More readable logs during development
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Database connection and server startup
const startServer = async () => {
  try {
    // First connect to database
    const dbConnected = await connectDB();

    if (!dbConnected) {
      throw new Error("Failed to connect to database");
    }

    // Then setup routes
    app.use("/api/auth", authRoutes);
    app.use("/api/projects", projectRoutes);
    app.use("/api/items", itemRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/reports", authenticateToken, reportRoutes);

    // Health check endpoint
    app.get("/api/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        database: isDatabaseConnected() ? "connected" : "disconnected",
        timestamp: new Date().toISOString(),
      });
    });

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // Setup cron jobs if database is connected
      if (isDatabaseConnected()) {
        cron.schedule("0 9 * * *", () => {
          console.log("Running daily deadline check...");
          checkDeadlines().catch((err) => {
            console.error("Error in deadline check:", err);
          });
        });
        console.log("Scheduled jobs initialized");
      }
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Shutting down gracefully...");
      server.close(async () => {
        if (pool) {
          await pool.end();
          console.log("Database pool closed");
        }
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
