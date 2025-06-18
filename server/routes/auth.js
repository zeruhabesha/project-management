// routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool, isDatabaseConnected } from "../config/database.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role = "user" } = req.body;
    const pool = getPool();

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT id FROM public.users WHERE email = $1", //QUALIFY DATABASE
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log("User already exists"); // Log user exists
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      "INSERT INTO public.users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role", //QUALIFY DATABASE
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Create token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "30d" }
    );

    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = getPool();

    // Check if user exists in database
    const result = await pool.query(
      "SELECT id, name, email, password, role FROM public.users WHERE email = $1", //QUALIFY DATABASE
      [email]
    );

    if (result.rows.length === 0) {
      console.log("Invalid credentials - user not found in database"); // Log invalid credentials
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check password for database users
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Invalid credentials - password mismatch"); // Log invalid credentials
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "30d" }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.log("No token provided"); // Log no token
      return res.status(401).json({ message: "No token provided" });
    }
    const pool = getPool();

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your_jwt_secret"
    );

    const result = await pool.query(
      "SELECT id, name, email, role FROM public.users WHERE id = $1", //QUALIFY DATABASE
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log("User not found"); // Log user not found
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Invalid token:", error.message); // Log token error
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
