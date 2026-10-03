import express from "express";
import { adminProtect } from '../middleware/authMiddleware.js';
import { userProtect } from '../middleware/userAuthMiddleware.js';
import {
  scheduleViewing,
  getAllAppointments,
  getAppointmentsByUser,
  cancelAppointment,
  updateAppointmentMeetingLink,
  getAppointmentStats,
  submitAppointmentFeedback,
  getUpcomingAppointments,
  updateAppointmentStatus
} from "../controller/appointmentController.js";


const router = express.Router();

// User routes — guest booking supported (no protect), auth booking also supported
router.post("/schedule", scheduleViewing);              // Guest booking (no auth required)
router.post("/schedule/auth", userProtect, scheduleViewing); // Authenticated booking
router.get("/user", userProtect, getAppointmentsByUser);
router.put("/cancel/:id", userProtect, cancelAppointment);
router.put("/feedback/:id", userProtect, submitAppointmentFeedback);
router.get("/upcoming", userProtect, getUpcomingAppointments);

// Admin routes
router.get("/all", adminProtect, getAllAppointments);
router.get("/stats", adminProtect, getAppointmentStats);
router.put("/status", adminProtect, updateAppointmentStatus);
router.put("/update-meeting", adminProtect, updateAppointmentMeetingLink);

export default router;