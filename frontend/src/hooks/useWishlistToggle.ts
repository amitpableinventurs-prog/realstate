import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { wishlistAPI, apiErrorMessage } from '../services/api';
import type { Property } from '../utils/propertyDisplay';

/**
 * Save / unsave a property (wishlist, technical document 6.5). Guests are sent
 * to sign in first. `onChange` receives the property with its new isSaved.
 */
export const useWishlistToggle = (onChange: (property: Property) => void) => {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(async (property: Property) => {
    if (!isAuthenticated) {
      navigate(`/signin?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    const saved = !property.isSaved;
    onChange({ ...property, isSaved: saved });
    try {
      if (saved) await wishlistAPI.add(property._id);
      else await wishlistAPI.remove(property._id);
      toast.success(saved ? t('wishlist.toastSaved') : t('wishlist.toastRemoved'));
    } catch (err) {
      onChange(property);
      toast.error(apiErrorMessage(err, t('wishlist.failed')));
    }
  }, [isAuthenticated, navigate, location, onChange, t]);
};
