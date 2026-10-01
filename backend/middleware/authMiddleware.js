import jwt from "jsonwebtoken";
import userModel, { Admin } from "../models/userModel.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

export const isSuperAdminEmail = (email) =>
  Boolean(email) && email === process.env.ADMIN_EMAIL;

// Shared by the admin guards: sends 401 and returns null when the token is
// missing or invalid (401 lets the admin panel refresh its access token).
const decodeAdminToken = (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({
      success: false,
      message: "Admin access denied - no token provided",
    });
    return null;
  }
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({
      success: false,
      message: "Admin access denied - invalid token",
    });
    return null;
  }
};

const deny = (res) =>
  res.status(403).json({
    success: false,
    message: "Admin access denied - invalid admin token",
  });

/** Super admin only (the ADMIN_EMAIL account). Guards everything except listing review. */
export const adminProtect = async (req, res, next) => {
  const decoded = decodeAdminToken(req, res);
  if (!decoded) return;

  if (!isSuperAdminEmail(decoded.email)) return deny(res);

  req.admin = { email: decoded.email, role: "superadmin", district: null };
  next();
};

/**
 * Listing review: the super admin, or an active district admin. District
 * admins get req.admin.district set; controllers must scope queries to it.
 */
export const reviewerProtect = async (req, res, next) => {
  const decoded = decodeAdminToken(req, res);
  if (!decoded) return;

  if (isSuperAdminEmail(decoded.email)) {
    req.admin = { email: decoded.email, role: "superadmin", district: null };
    return next();
  }
  if (!decoded.email) return deny(res);

  try {
    // Checked on every request so disabling an account or moving it to
    // another district takes effect immediately, not when the token expires
    const admin = await Admin.findOne({ email: decoded.email, role: "district_admin", isActive: true })
      .select("email district")
      .populate("district", "name");
    if (!admin?.district) return deny(res);

    req.admin = {
      email: admin.email,
      role: "district_admin",
      district: admin.district._id,
      districtName: admin.district.name,
    };
    next();
  } catch (error) {
    console.error("Reviewer auth error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// In backend/middleware/authmiddleware.js
export const checkAppointmentOwnership = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appointment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this appointment",
      });
    }

    req.appointment = appointment;
    next();
  } catch (error) {
    console.error("Error checking appointment ownership:", error);
    res.status(500).json({
      success: false,
      message: "Error checking appointment ownership",
    });
  }
};

export default protect;
