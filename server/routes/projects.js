import express from 'express';
import { pool, isDatabaseConnected } from '../config/database.js';
import { authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Mock projects data for demo when database is not connected
const mockProjects = [
  {
    id: '1',
    name: 'Office Complex Construction',
    ref_no: 'PRJ-2024-001',
    client: 'ABC Corporation',
    status: 'in_progress',
    start_date: '2024-01-15',
    end_date: '2024-06-30',
    tender_value: 850000,
    manager_ids: ['1', '2'],
    description: 'Construction of a modern 15-story office complex',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-02-20T14:30:00Z',
    total_items: 45,
    completed_items: 28
  },
  {
    id: '2',
    name: 'Shopping Mall Development',
    ref_no: 'PRJ-2024-002',
    client: 'XYZ Retail Ltd',
    status: 'completed',
    start_date: '2023-09-01',
    end_date: '2024-02-28',
    tender_value: 1200000,
    manager_ids: ['2'],
    description: 'Development of a modern shopping mall',
    created_at: '2023-09-01T09:00:00Z',
    updated_at: '2024-02-28T16:00:00Z',
    total_items: 67,
    completed_items: 67
  }
];

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { status, client, page = 1, limit = 10 } = req.query;

    if (!isDatabaseConnected()) {
      // Return mock data for demo
      let filteredProjects = [...mockProjects];
      
      if (status) {
        filteredProjects = filteredProjects.filter(p => p.status === status);
      }
      
      if (client) {
        filteredProjects = filteredProjects.filter(p => 
          p.client.toLowerCase().includes(client.toLowerCase())
        );
      }

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

      return res.json({
        success: true,
        data: paginatedProjects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredProjects.length,
          pages: Math.ceil(filteredProjects.length / limit)
        }
      });
    }

    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, 
             COUNT(i.id) as total_items,
             COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_items
      FROM projects p
      LEFT JOIN items i ON p.id = i.project_id
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
    let countQuery = 'SELECT COUNT(DISTINCT p.id) FROM projects p';
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

    if (!isDatabaseConnected()) {
      // Return mock data for demo
      const project = mockProjects.find(p => p.id === id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      return res.json({
        success: true,
        data: {
          ...project,
          stats: {
            total_items: project.total_items || 0,
            completed_items: project.completed_items || 0,
            in_progress_items: 12,
            pending_items: 5,
            overdue_items: 2,
            total_cost: 720000,
            progress_percentage: project.completed_items > 0 ? 
              Math.round((project.completed_items / project.total_items) * 100) : 0
          }
        }
      });
    }

    const projectResult = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (projectResult.rows.length === 0) {
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
      FROM items 
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

// Create project
router.post('/', authorizeRoles('admin', 'manager'), async (req, res) => {
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

    if (!isDatabaseConnected()) {
      return res.status(503).json({ message: 'Database not available for creating projects' });
    }

    const result = await pool.query(`
      INSERT INTO projects (name, ref_no, start_date, end_date, client, manager_ids, description, tender_value)
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

    if (!isDatabaseConnected()) {
      return res.status(503).json({ message: 'Database not available for updating projects' });
    }

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = [id, ...Object.values(updates)];

    const result = await pool.query(`
      UPDATE projects 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
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

    if (!isDatabaseConnected()) {
      return res.status(503).json({ message: 'Database not available for deleting projects' });
    }

    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
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

export default router;