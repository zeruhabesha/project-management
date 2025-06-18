// middleware/auth.js

import jwt from "jsonwebtoken";
import { getPool, isDatabaseConnected } from "../config/database.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
    const decoded = jwt.verify(token, jwtSecret);

    // Get the pool instance
    const pool = getPool();

    // Get user from database
    const result = await pool.query(
      "SELECT id, name, email, role FROM public.users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log("User not found in database");
      return res.status(401).json({ message: "User not found" });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error("Invalid token:", error.message);
    return res.status(403).json({ message: "Invalid token" });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      // Check if user or role exists
      console.warn(
        "User or role is undefined. Authentication may have failed."
      );
      return res
        .status(403)
        .json({ message: "Access denied.  User role not found." });
    }

    if (!roles.includes(req.user.role)) {
      console.log(
        `User role ${
          req.user.role
        } not authorized for this endpoint. Required roles: ${roles.join(", ")}`
      );
      return res.status(403).json({
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

export const errorHandler = (err, req, res, next) => {
  console.error("Error Handler:", err.stack);

  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId (Adjusted to check 'name' property more generically)
  if (err.name === "CastError") {
    const message = "Resource not found";
    error = { message, status: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = "Duplicate field value entered";
    error = { message, status: 400 };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = { message, status: 400 };
  }

  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Server Error",
  });
};
