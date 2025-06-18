// routes/projects.js

import express from 'express';
import { pool, isDatabaseConnected } from '../config/database.js';
import { authorizeRoles, authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Set up multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(process.cwd(), 'server', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, base + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images, PDF, and Word documents are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Get all projects
router.get('/', async (req, res) => {
    try {
        const { status, client, page = 1, limit = 10 } = req.query;

        const offset = (page - 1) * limit;

        let query = `
            SELECT p.*,
                   COUNT(i.id) as total_items,
                   COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_items
            FROM public.projects p //QUALIFY DATABASE
            LEFT JOIN public.items i ON p.id = i.project_id //QUALIFY DATABASE
        `;

        const conditions = [];
        const values = [];

        if (status) {
            conditions.push(`p.status = $${values.length + 1}`);
            values.push(status);
        }

        if (client) {
            conditions.push(`p.client ILIKE $${values.length + 1}`);
            values.push(`%${client}%`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(DISTINCT p.id) FROM public.projects p'; //QUALIFY DATABASE
        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }

        const countResult = await pool.query(countQuery, values.slice(0, -2));
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get project by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const projectResult = await pool.query(
            'SELECT * FROM public.projects WHERE id = $1', //QUALIFY DATABASE
            [id]
        );

        if (projectResult.rows.length === 0) {
            console.log(`Project with ID ${id} not found in database`); // Log database not found
            return res.status(404).json({ message: 'Project not found' });
        }

        const project = projectResult.rows[0];

        // Get project statistics
        const statsResult = await pool.query(`
            SELECT
              COUNT(*) as total_items,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items,
              COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_items,
              COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_items,
              COUNT(CASE WHEN deadline < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_items,
              SUM(quantity * unit_price) as total_cost
            FROM public.items //QUALIFY DATABASE
            WHERE project_id = $1
        `, [id]);

        const stats = statsResult.rows[0];

        res.json({
            success: true,
            data: {
                ...project,
                stats: {
                    total_items: parseInt(stats.total_items) || 0,
                    completed_items: parseInt(stats.completed_items) || 0,
                    in_progress_items: parseInt(stats.in_progress_items) || 0,
                    pending_items: parseInt(stats.pending_items) || 0,
                    overdue_items: parseInt(stats.overdue_items) || 0,
                    total_cost: parseFloat(stats.total_cost) || 0,
                    progress_percentage: stats.total_items > 0 ?
                        Math.round((stats.completed_items / stats.total_items) * 100) : 0
                }
            }
        });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create projectauthorizeRoles('admin', 'manager')
router.post('/', async (req, res) => {
    try {
        const {
            name,
            ref_no,
            start_date,
            end_date,
            client,
            manager_ids,
            description,
            tender_value
        } = req.body;

        const result = await pool.query(`
            INSERT INTO public.projects (name, ref_no, start_date, end_date, client, manager_ids, description, tender_value) //QUALIFY DATABASE
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [name, ref_no, start_date, end_date, client, manager_ids, description, tender_value]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create project error:', error);
        if (error.code === '23505') {
            console.log('Project reference number already exists'); // Log duplicate ref number
            return res.status(400).json({ message: 'Project reference number already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Update project
router.put('/:id', authorizeRoles('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const result = await pool.query(`
            UPDATE public.projects  //QUALIFY DATABASE
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [values]);

        if (result.rows.length === 0) {
            console.log(`Project with ID ${id} not found`); // Log if project not found
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete project
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM public.projects WHERE id = $1 RETURNING *',  //QUALIFY DATABASE
            [id]
        );

        if (result.rows.length === 0) {
            console.log(`Project with ID ${id} not found`); // Log if project not found
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json({
            success: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload file to a project
router.post('/:id/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            console.log('No file uploaded'); // Log no file upload
            return res.status(400).json({ message: 'No file uploaded' });
        }
        // Optionally, you can save file info to the database here, associated with the project
        res.status(201).json({
            success: true,
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: `/api/projects/${req.params.id}/download/${req.file.filename}`
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ message: 'File upload failed' });
    }
});

// Download file from a project
router.get('/:id/download/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(process.cwd(), 'server', 'uploads', filename);
        if (!fs.existsSync(filePath)) {
            console.log(`File ${filename} not found`); // Log file not found
            return res.status(404).json({ message: 'File not found' });
        }
        res.download(filePath, filename);
    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ message: 'File download failed' });
    }
});

export default router;