import AdminActivityLog from "../models/adminActivityLogModel.js";
import createCsvWriter from 'csv-writer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';

// Admin audit trail (technical document 10: audit logs for admin actions).

/**
 * GET /api/admin/activity-logs
 * Get activity logs with pagination and filters
 */
export const getActivityLogs = async (req, res) => {
  try {
    // Check if database is connected
    if (!mongoose.connection.readyState) {
      console.warn('Database not connected for getActivityLogs');
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable',
        code: 'DB_NOT_CONNECTED'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query from filters
    const query = {};
    
    if (req.query.action) {
      query.action = req.query.action;
    }
    if (req.query.targetType) {
      query.targetType = req.query.targetType;
    }
    if (req.query.adminEmail) {
      query.adminEmail = req.query.adminEmail;
    }
   
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Get total count
    const totalLogs = await AdminActivityLog.countDocuments(query);
    const totalPages = Math.ceil(totalLogs / limit);

    // Get logs
    const logs = await AdminActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    res.json({
      success: true,
      logs,
      pagination: {
        currentPage: page,
        totalPages,
        totalLogs,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit
      }
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ success: false, message: "Error fetching activity logs" });
  }
};

/**
 * GET /api/admin/activity-logs/export
 * Export activity logs as CSV
 */
export const exportActivityLogs = async (req, res) => {
  try {
    // Build query from filters (same as getActivityLogs)
    const query = {};
    
    if (req.query.action) query.action = req.query.action;
    if (req.query.targetType) query.targetType = req.query.targetType;
    if (req.query.adminEmail) query.adminEmail = req.query.adminEmail;
    
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    // Get all matching logs (limit to 10000 for performance)
    const logs = await AdminActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(10000);

    // Convert to CSV
    const csvPath = path.join(os.tmpdir(), `activity-logs-${Date.now()}.csv`);
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'createdAt', title: 'Timestamp' },
        { id: 'adminEmail', title: 'Admin' },
        { id: 'action', title: 'Action' },
        { id: 'targetType', title: 'Target Type' },
        { id: 'targetName', title: 'Target' },
        { id: 'reason', title: 'Reason' },
        { id: 'count', title: 'Count' },
        { id: 'ipAddress', title: 'IP Address' }
      ]
    });

    // Format records
    const records = logs.map(log => ({
      createdAt: log.createdAt.toISOString(),
      adminEmail: log.adminEmail,
      action: log.action,
      targetType: log.targetType,
      targetName: log.targetName || '',
      reason: log.metadata?.reason || '',
      count: log.metadata?.count || '',
      ipAddress: log.ipAddress
    }));

    await csvWriter.writeRecords(records);

    // Send file
    res.download(csvPath, 'activity-logs.csv', (err) => {
      if (err) {
        console.error('CSV download error:', err);
      }
      // Clean up temp file
      try {
        fs.unlinkSync(csvPath);
      } catch (unlinkErr) {
        console.error('Failed to delete temp file:', unlinkErr);
      }
    });
  } catch (error) {
    console.error("Error exporting activity logs:", error);
    res.status(500).json({ success: false, message: "Error exporting activity logs" });
  }
};
