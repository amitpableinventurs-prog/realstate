import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Shield, ArrowRight, Loader2, Building2, Users, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../services/apiClient";
import { cn } from "../lib/utils";
import { getAdminSession, homePathFor } from "../lib/adminSession";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post('/api/users/admin', {
        email,
        password,
      });

      if (response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("isAdmin", "true");
        const session = getAdminSession();
        toast.success(`Welcome back, ${session?.name || "Admin"}!`);
        navigate(homePathFor(session));
      } else {
        toast.error(response.data.message || "Login failed");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      toast.error(error.response?.data?.message || "Invalid admin credentials");
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Building2, label: "Properties", value: "500+" },
    { icon: Users, label: "Happy Clients", value: "2,000+" },
    { icon: TrendingUp, label: "Deals Closed", value: "1,200+" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Dark Branding */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="hidden lg:flex lg:w-1/2 bg-[#17131A] flex-col justify-between p-12 relative overflow-hidden"
      >
        {/* Background texture */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, #A3078F 0%, transparent 50%), radial-gradient(circle at 75% 75%, #A3078F 0%, transparent 50%)`,
            }}
          />
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#A3078F]/10 rounded-full" />
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#A3078F]/5 rounded-full" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center">
              <img src="/logo.png" alt="Bhumi Bazar" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-xl font-bold text-[#FAF8FB]">Bhumi Bazar</div>
              <div className="text-xs text-[#9CA3AF] uppercase tracking-widest">Admin Panel</div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-[#FAF8FB] leading-tight mb-4">
            Manage Your
            <br />
            <span className="text-[#A3078F]">Real Estate</span>
            <br />
            Portfolio
          </h1>
          <p className="text-[#9CA3AF] text-base leading-relaxed max-w-xs">
            A powerful admin dashboard to manage properties, appointments, and clients — all in one place.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <Icon className="w-5 h-5 text-[#A3078F] mb-2" />
              <div className="text-xl font-bold text-[#FAF8FB]">{value}</div>
              <div className="text-xs text-[#9CA3AF]">{label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-[#5A5856]">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured with 256-bit encryption • Bhumi Bazar © 2025</span>
        </div>
      </motion.div>

      {/* Right Panel — Login Form */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="flex-1 flex items-center justify-center bg-[#FAF8FB] px-6 py-12"
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-white border border-[#E6D6E8] rounded-xl p-1 flex items-center justify-center">
              <img src="/logo.png" alt="Bhumi Bazar" className="h-full w-full object-contain" />
            </div>
            <div className="text-lg font-bold text-[#17131A]">Bhumi Bazar Admin</div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#17131A] mb-2">Welcome back</h2>
            <p className="text-[#5A5856]">Sign in to your admin account to continue</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#17131A] mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className={cn(
                    "h-4.5 w-4.5 transition-colors duration-200",
                    focusedField === "email" ? "text-[#A3078F]" : "text-[#9CA3AF]"
                  )} />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="admin@buildestate.com"
                  className={cn(
                    "w-full pl-11 pr-4 py-3.5 bg-white border rounded-xl text-[#17131A] placeholder-[#9CA3AF] text-sm transition-all duration-200 outline-none",
                    focusedField === "email"
                      ? "border-[#A3078F] ring-3 ring-[#A3078F]/15 shadow-sm"
                      : "border-[#E6D6E8] hover:border-[#A3078F]/50"
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#17131A] mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className={cn(
                    "h-4.5 w-4.5 transition-colors duration-200",
                    focusedField === "password" ? "text-[#A3078F]" : "text-[#9CA3AF]"
                  )} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  className={cn(
                    "w-full pl-11 pr-12 py-3.5 bg-white border rounded-xl text-[#17131A] placeholder-[#9CA3AF] text-sm transition-all duration-200 outline-none",
                    focusedField === "password"
                      ? "border-[#A3078F] ring-3 ring-[#A3078F]/15 shadow-sm"
                      : "border-[#E6D6E8] hover:border-[#A3078F]/50"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#9CA3AF] hover:text-[#A3078F] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.99 }}
              className="w-full flex items-center justify-center gap-2.5 bg-[#17131A] hover:bg-[#A3078F] text-[#FAF8FB] py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-terracotta disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to Dashboard
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Security note */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#9CA3AF]">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure admin access only</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;