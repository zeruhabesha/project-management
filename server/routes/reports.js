// routes/reports.js

import express from 'express';
import { pool } from '../config/database.js';

const router = express.Router();

// Get project progress report
router.get('/projects/:id/progress', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
              p.name as project_name,
              p.start_date,
              p.end_date,
              COUNT(i.id) as total_items,
              COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_items,
              COUNT(CASE WHEN i.status = 'in_progress' THEN 1 END) as in_progress_items,
              COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_items,
              COUNT(CASE WHEN i.deadline < CURRENT_DATE AND i.status != 'completed' THEN 1 END) as overdue_items
            FROM projects p
            LEFT JOIN items i ON p.id = i.project_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (result.rows.length === 0) {
            console.log(`Project with ID ${id} not found`); // Log project not found
            return res.status(404).json({ message: 'Project not found' });
        }

        const progressData = result.rows[0];

        // Get phase breakdown
        const phaseResult = await pool.query(`
            SELECT
              ph.name as phase_name,
              COUNT(i.id) as total_items,
              COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_items
            FROM phases ph
            LEFT JOIN items i ON ph.id = i.phase_id
            WHERE ph.project_id = $1
            GROUP BY ph.id, ph.name
            ORDER BY ph.sequence_order
        `, [id]);

        res.json({
            success: true,
            data: {
                ...progressData,
                phases: phaseResult.rows
            }
        });
    } catch (error) {
        console.error('Get progress report error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get project cost report
router.get('/projects/:id/cost', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT
              p.name as project_name,
              p.tender_value,
              SUM(i.quantity * i.unit_price) as material_cost,
              SUM(i.taxes) as total_taxes,
              COUNT(i.id) as total_items
            FROM projects p
            LEFT JOIN items i ON p.id = i.project_id
            WHERE p.id = $1
            GROUP BY p.id
        `, [id]);

        if (result.rows.length === 0) {
            console.log(`Project with ID ${id} not found`); // Log project not found
            return res.status(404).json({ message: 'Project not found' });
        }

        const costData = result.rows[0];

        // Calculate profit and margin
        const totalCost = (parseFloat(costData.material_cost) || 0) + (parseFloat(costData.total_taxes) || 0);
        const tenderValue = parseFloat(costData.tender_value) || 0;
        const profit = tenderValue - totalCost;
        const margin = tenderValue > 0 ? (profit / tenderValue) * 100 : 0;

        // Get cost breakdown by category
        const categoryResult = await pool.query(`
            SELECT
              i.type,
              SUM(i.quantity * i.unit_price) as cost,
              COUNT(i.id) as item_count
            FROM items i
            WHERE i.project_id = $1
            GROUP BY i.type
            ORDER BY cost DESC
        `, [id]);

        res.json({
            success: true,
            data: {
                ...costData,
                total_cost: totalCost,
                profit,
                margin: Math.round(margin * 100) / 100,
                cost_breakdown: categoryResult.rows
            }
        });
    } catch (error) {
        console.error('Get cost report error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dashboard overview
router.get('/dashboard', async (req, res) => {
    try {
        // Get project statistics
        const projectStats = await pool.query(`
            SELECT
              COUNT(*) as total_projects,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
              COUNT(CASE WHEN end_date < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_projects
            FROM projects
        `);

        // Get item statistics
        const itemStats = await pool.query(`
            SELECT
              COUNT(*) as total_items,
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items,
              COUNT(CASE WHEN deadline < CURRENT_DATE AND status != 'completed' THEN 1 END) as overdue_items,
              SUM(quantity * unit_price) as total_value
            FROM items
        `);

        // Get recent alerts
        const alertsResult = await pool.query(`
            SELECT a.*, p.name as project_name, i.name as item_name
            FROM alerts a
            JOIN projects p ON a.project_id = p.id
            LEFT JOIN items i ON a.item_id = i.id
            WHERE a.is_read = false
            ORDER BY a.triggered_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            data: {
                projects: projectStats.rows[0],
                items: itemStats.rows[0],
                alerts: alertsResult.rows
            }
        });
    } catch (error) {
        console.error('Get dashboard overview error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;