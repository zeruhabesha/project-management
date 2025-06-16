import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, isDatabaseConnected } from '../config/database.js';

const router = express.Router();

// Mock users for demo when database is not connected
const mockUsers = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@demo.com',
    password: 'password', // Plain text for demo
    role: 'admin'
  },
  {
    id: '2',
    name: 'Manager User',
    email: 'manager@demo.com',
    password: 'password', // Plain text for demo
    role: 'manager'
  }
];

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    if (!isDatabaseConnected()) {
      return res.status(503).json({ message: 'Database not available for registration' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Create token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;

    if (!isDatabaseConnected()) {
      // Use mock users for demo
      user = mockUsers.find(u => u.email === email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // For mock users, do simple password comparison
      if (user.password !== password) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    } else {
      // Check if user exists in database
      const result = await pool.query(
        'SELECT id, name, email, password, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      user = result.rows[0];

      // Check password for database users
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    }

    // Create token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '30d' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    let user = null;

    if (!isDatabaseConnected()) {
      // Use mock user for demo
      user = mockUsers.find(u => u.id === decoded.userId);
      if (!user) {
        user = mockUsers[0]; // Default to first mock user
      }
      const { password: _, ...userWithoutPassword } = user;
      user = userWithoutPassword;
    } else {
      const result = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      user = result.rows[0];
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;