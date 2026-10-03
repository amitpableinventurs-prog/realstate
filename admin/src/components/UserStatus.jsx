import PropTypes from 'prop-types';
import { cn } from '../lib/utils';

// Active / Deactivated / Deleted badge for a user from /api/v1/admin/users
const UserStatus = ({ user }) => {
  const [label, className] = user.is_deleted
    ? ["Deleted", "bg-[#F5F5F3] text-[#6B6B6A] border-[#E8E7E5]"]
    : user.is_active
      ? ["Active", "bg-emerald-50 text-emerald-700 border-emerald-200/60"]
      : ["Deactivated", "bg-red-50 text-red-700 border-red-200/60"];
  return <span className={cn("text-xs font-medium border px-2 py-0.5 rounded-full", className)}>{label}</span>;
};

UserStatus.propTypes = { user: PropTypes.object.isRequired };

export default UserStatus;
