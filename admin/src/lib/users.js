import { toast } from 'sonner';
import apiClient from '../services/apiClient';

/** Activates or deactivates a user; returns the updated user. */
export const setUserActive = async (user, isActive) => {
  if (!isActive && !window.confirm(`Deactivate ${user.name || user.mobile}? They are logged out and cannot log in until activated again.`)) {
    return null;
  }
  const { data } = await apiClient.patch(`/api/v1/admin/users/${user.id}`, { is_active: isActive });
  toast.success(data.message);
  return data.data;
};
