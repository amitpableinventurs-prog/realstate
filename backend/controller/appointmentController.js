import Property from '../models/propertyModel.js';

// Site visits for approved properties. Signed-in users (req.user, from a
// /api/v1 user token) and guests can book; the admin manages them.

const PROPERTY_FIELDS = 'listing_type khata_number khasra_number area images district_id';
const USER_FIELDS = 'name email mobile';
import mongoose from 'mongoose';
import Appointment from '../models/appointmentModel.js';
import emailService from '../services/emailService.js';
import { getMeetingLinkTemplate } from '../email.js';

// Appointment management
export const getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('propertyId', PROPERTY_FIELDS)
      .populate('userId', USER_FIELDS)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments'
    });
  }
};

// Schedule viewing — supports both authenticated and guest bookings
export const scheduleViewing = async (req, res) => {
  try {
    const { propertyId, date, time, notes, name, email, phone, message } = req.body;

    // req.user is set by protect middleware (may be undefined for guest route)
    const userId = req.user?._id;
    const guestEmail = email;
    const guestName = name;

    // Check if property exists
    const property = mongoose.isValidObjectId(propertyId) && await Property.findOne({ _id: propertyId, status: 'APPROVED' });
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check for duplicate appointments
    const existingAppointment = await Appointment.findOne({
      propertyId,
      date,
      time,
      status: { $ne: 'cancelled' }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    // Build appointment data — link user if logged in, else store guest info
    const appointmentData = {
      propertyId,
      date,
      time,
      notes: notes || message || '',
      status: 'pending',
      ...(userId && { userId }),
      ...(!userId && { guestInfo: { name: guestName, email: guestEmail, phone } })
    };

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    // Populate what we can — userId may not exist for guests
    await appointment.populate([{ path: 'propertyId', select: PROPERTY_FIELDS }, ...(userId ? [{ path: 'userId', select: USER_FIELDS }] : [])]);

    // Send confirmation email
    const recipientEmail = userId ? req.user.email : guestEmail;
    if (recipientEmail) {
      emailService.sendAppointmentScheduled(recipientEmail, appointment, date, time, notes || message || '').catch(emailErr => {
        console.error('Confirmation email failed:', emailErr.message);
      });
    }

    // Notify admin of new booking (non-fatal)
    const userDetails = {
      name: userId ? (req.user.name || 'User') : (guestName || 'Guest'),
      email: userId ? (req.user.email || '') : guestEmail,
      phone: userId ? req.user.mobile : (phone || ''),
    };
    emailService.sendAppointmentNotificationToAdmin(appointment, userDetails).catch(err => {
      console.error('Admin appointment notification failed:', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Viewing scheduled successfully',
      appointment
    });
  } catch (error) {
    console.error('Error scheduling viewing:', error);
    res.status(500).json({
      success: false,
      message: 'Error scheduling viewing'
    });
  }
};

// Add this with other exports
export const cancelAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const appointment = await Appointment.findById(appointmentId)
      .populate('propertyId', PROPERTY_FIELDS)
      .populate('userId', USER_FIELDS);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Verify user owns this appointment (skip for guest bookings cancelled by admin)
    if (appointment.userId && req.user && appointment.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancelReason = req.body.reason || 'Cancelled by user';
    await appointment.save();

    // Send cancellation email
    const recipientEmail = appointment.userId?.email || appointment.guestInfo?.email;
    if (recipientEmail) {
      emailService.sendAppointmentStatusUpdate(recipientEmail, appointment, 'cancelled').catch(emailErr => {
        console.error('Cancellation email failed:', emailErr.message);
      });
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment'
    });
  }
};

// Add this function to get user's appointments
export const getAppointmentsByUser = async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user._id })
      .populate('propertyId', PROPERTY_FIELDS)
      .sort({ date: 1 });

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments'
    });
  }
};

export const updateAppointmentMeetingLink = async (req, res) => {
  try {
    const { appointmentId, meetingLink } = req.body;
    
    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { meetingLink },
      { new: true }
    ).populate([{ path: 'propertyId', select: PROPERTY_FIELDS }, { path: 'userId', select: USER_FIELDS }]);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Send meeting link email
    const recipientEmail = appointment.userId?.email || appointment.guestInfo?.email;
    if (recipientEmail) {
      emailService.sendEmailSafely(
        recipientEmail,
        'Your Virtual Meeting Link - Bhumi Bazar',
        getMeetingLinkTemplate(appointment, meetingLink)
      );
    }

    res.json({
      success: true,
      message: 'Meeting link updated successfully',
      appointment
    });
  } catch (error) {
    console.error('Error updating meeting link:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating meeting link'
    });
  }
};


// Add at the end of the file

export const getAppointmentStats = async (req, res) => {
  try {
    const [pending, confirmed, cancelled, completed] = await Promise.all([
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'cancelled' }),
      Appointment.countDocuments({ status: 'completed' })
    ]);

    // Get stats by day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        total: pending + confirmed + cancelled + completed,
        pending,
        confirmed,
        cancelled,
        completed,
        dailyStats
      }
    });
  } catch (error) {
    console.error('Error fetching appointment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment statistics'
    });
  }
};

export const submitAppointmentFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (!appointment.userId || appointment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit feedback for this appointment'
      });
    }

    appointment.feedback = { rating, comment };
    appointment.status = 'completed';
    await appointment.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback'
    });
  }
};

export const getUpcomingAppointments = async (req, res) => {
  try {
    const now = new Date();
    const appointments = await Appointment.find({
      userId: req.user._id,
      date: { $gte: now },
      status: { $in: ['pending', 'confirmed'] }
    })
    .populate('propertyId', PROPERTY_FIELDS)
    .sort({ date: 1, time: 1 })
    .limit(5);

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Error fetching upcoming appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upcoming appointments'
    });
  }
};

// PUT /api/appointments/status { appointmentId, status } (admin)
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId, status } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true }
    ).populate([{ path: "propertyId", select: PROPERTY_FIELDS }, { path: "userId", select: USER_FIELDS }]);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Send email notification (guest bookings may have no userId)
    const recipientEmail = appointment.userId?.email || appointment.guestInfo?.email;
    if (recipientEmail) {
      try {
        await emailService.sendAppointmentStatusUpdate(recipientEmail, appointment, status);
      } catch (emailError) {
        console.error('Failed to send appointment status email:', emailError);
      }
    }

    res.json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment,
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating appointment",
    });
  }
};
