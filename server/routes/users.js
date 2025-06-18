// routes/users.js

import express from 'express';
import bcrypt from 'bcryptjs';
import { pool, getPool, isDatabaseConnected } from '../config/database.js';
import { authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// 🟢 Get all users
router.get('/', async (req, res) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ message: 'Database not connected' });
        }

        const result = await getPool().query('SELECT * FROM public.users');
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// 🟢 Create user (admins only)
router.post('/', async (req, res) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ message: 'Database not connected' });
        }

        const { name, email, password, role } = req.body;

        // Check for existing user
        const existing = await getPool().query('SELECT * FROM public.users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await getPool().query(
            'INSERT INTO public.users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hashedPassword, role]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// 🟢 Update user by ID (admin only)
router.put('/:id', authorizeRoles('admin'), async (req, res) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ message: 'Database not connected' });
        }

        const { id } = req.params;
        const { name, email, role, password } = req.body;

        let query = 'UPDATE public.users SET name = $1, email = $2, role = $3';
        const values = [name, email, role];
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = $4';
            values.push(hashedPassword);
        }

        query += ', updated_at = CURRENT_TIMESTAMP WHERE id = $' + (values.length + 1) + ' RETURNING id, name, email, role';
        values.push(id);

        const result = await getPool().query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// 🟢 Delete user by ID (admin only)
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
    try {
        if (!isDatabaseConnected()) {
            return res.status(503).json({ message: 'Database not connected' });
        }

        const { id } = req.params;
        const result = await getPool().query('DELETE FROM public.users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

export default router;
