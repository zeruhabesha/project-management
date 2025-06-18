// routes/items.js

import express from "express";
import { getPool } from "../config/database.js";
const router = express.Router();

// Get items for a project
router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const { projectId, status, type, phase, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
            SELECT i.*, s.company as supplier_name, u.name as assigned_user_name, p.name as phase_name
            FROM public.items i //QUALIFY DATABASE
            LEFT JOIN public.suppliers s ON i.supplier_id = s.id //QUALIFY DATABASE
            LEFT JOIN public.users u ON i.assigned_to = u.id //QUALIFY DATABASE
            LEFT JOIN public.phases p ON i.phase_id = p.id //QUALIFY DATABASE
        `;

    const conditions = [];
    const values = [];

    if (projectId) {
      conditions.push(`i.project_id = $${values.length + 1}`);
      values.push(projectId);
    }

    if (status) {
      conditions.push(`i.status = $${values.length + 1}`);
      values.push(status);
    }

    if (type) {
      conditions.push(`i.type = $${values.length + 1}`);
      values.push(type);
    }

    if (phase) {
      conditions.push(`i.phase_id = $${values.length + 1}`);
      values.push(phase);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${values.length + 1} OFFSET $${
      values.length + 2
    }`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create item
router.post("/", async (req, res) => {
  try {
    const pool = getPool();

    const itemData = req.body;

    const columns = Object.keys(itemData).join(", ");
    const placeholders = Object.keys(itemData)
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const values = Object.values(itemData);

    const result = await pool.query(
      `
            INSERT INTO public.items (${columns}) //QUALIFY DATABASE
            VALUES (${placeholders})
            RETURNING *
        `,
      values
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update item
router.put("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const { id } = req.params;
    const updates = req.body;

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(", ");

    const values = [id, ...Object.values(updates)];

    const result = await pool.query(
      `
            UPDATE public.items  //QUALIFY DATABASE
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `,
      values
    );

    if (result.rows.length === 0) {
      console.log(`Item with ID ${id} not found`); // Log if item not found
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete item
router.delete("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM public.items WHERE id = $1 RETURNING *", //QUALIFY DATABASE
      [id]
    );

    if (result.rows.length === 0) {
      console.log(`Item with ID ${id} not found`); // Log if item not found
      return res.status(404).json({ message: "Item not found" });
    }

    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
