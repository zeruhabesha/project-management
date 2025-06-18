// services/alertService.js
import express from "express";
import nodemailer from "nodemailer";
import { getPool, isDatabaseConnected } from "../config/database.js";
const router = express.Router();
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const checkDeadlines = async () => {
  try {
    const pool = getPool();

    // Check for items approaching deadline (3 days)
    const approachingResult = await pool.query(`
            SELECT i.*, p.name as project_name, u.email as assigned_email
            FROM public.items i //QUALIFY DATABASE
            JOIN public.projects p ON i.project_id = p.id //QUALIFY DATABASE
            LEFT JOIN public.users u ON i.assigned_to = u.id //QUALIFY DATABASE
            WHERE i.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
            AND i.status != 'completed'
            AND NOT EXISTS (
                SELECT 1 FROM public.alerts a //QUALIFY DATABASE
                WHERE a.item_id = i.id
                AND a.type = 'deadline_approaching'
                AND a.triggered_at > CURRENT_DATE - INTERVAL '1 day'
            )
        `);

    // Check for overdue items
    const overdueResult = await pool.query(`
            SELECT i.*, p.name as project_name, u.email as assigned_email
            FROM public.items i  //QUALIFY DATABASE
            JOIN public.projects p ON i.project_id = p.id //QUALIFY DATABASE
            LEFT JOIN public.users u ON i.assigned_to = u.id //QUALIFY DATABASE
            WHERE i.deadline < CURRENT_DATE
            AND i.status != 'completed'
            AND NOT EXISTS (
                SELECT 1 FROM public.alerts a //QUALIFY DATABASE
                WHERE a.item_id = i.id
                AND a.type = 'overdue'
                AND a.triggered_at > CURRENT_DATE - INTERVAL '1 day'
            )
        `);

    // Create alerts for approaching deadlines
    for (const item of approachingResult.rows) {
      try {
        await pool.query(
          `
                    INSERT INTO public.alerts (item_id, project_id, type, message, severity) //QUALIFY DATABASE
                    VALUES ($1, $2, $3, $4, $5)
                `,
          [
            item.id,
            item.project_id,
            "deadline_approaching",
            `Item "${item.name}" deadline approaching in ${Math.ceil(
              (new Date(item.deadline) - new Date()) / (1000 * 60 * 60 * 24)
            )} days`,
            "medium",
          ]
        );

        // Send email if user is assigned
        if (item.assigned_email) {
          await sendDeadlineEmail(item, "approaching", item); // Pass the item
        }
      } catch (error) {
        console.error(
          `Error creating alert for approaching deadline for item ${item.id}:`,
          error
        );
      }
    }

    // Create alerts for overdue items
    for (const item of overdueResult.rows) {
      try {
        await pool.query(
          `
                    INSERT INTO public.alerts (item_id, project_id, type, message, severity) //QUALIFY DATABASE
                    VALUES ($1, $2, $3, $4, $5)
                `,
          [
            item.id,
            item.project_id,
            "overdue",
            `Item "${item.name}" is overdue by ${Math.ceil(
              (new Date() - new Date(item.deadline)) / (1000 * 60 * 60 * 24)
            )} days`,
            "high",
          ]
        );

        // Send email if user is assigned
        if (item.assigned_email) {
          await sendDeadlineEmail(item, "overdue", item); // Pass the item
        }
      } catch (error) {
        console.error(
          `Error creating alert for overdue item ${item.id}:`,
          error
        );
      }
    }

    console.log(
      `Created ${approachingResult.rows.length} approaching deadline alerts`
    );
    console.log(`Created ${overdueResult.rows.length} overdue alerts`);
  } catch (error) {
    console.error("Check deadlines error:", error);
  }
};

const sendDeadlineEmail = async (type, item) => {
  //Expect 'item' object now
  try {
    const pool = getPool();

    if (
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.SMTP_FROM
    ) {
      console.warn("SMTP credentials missing.  Skipping email.");
      return;
    }
    const subject =
      type === "approaching"
        ? `Deadline Approaching: ${item.name}`
        : `Overdue Alert: ${item.name}`;

    const html = `
            <h2>${subject}</h2>
            <p><strong>Project:</strong> ${item.project_name}</p>
            <p><strong>Item:</strong> ${item.name}</p>
            <p><strong>Deadline:</strong> ${new Date(
              item.deadline
            ).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${item.status}</p>
            <p>Please take appropriate action to complete this item.</p>
        `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: item.assigned_email,
      subject,
      html,
    });

    console.log(`Email sent to ${item.assigned_email} for item ${item.id}`);
  } catch (error) {
    console.error("Send email error:", error);
  }
};
