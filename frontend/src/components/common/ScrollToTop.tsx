import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Scrolls to the top on navigation, or to the #section in the URL
// (e.g. /privacy#cookies) once the lazy-loaded page has rendered it.
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target || ++tries > 40) {
        window.clearInterval(timer);
        if (target) target.scrollIntoView();
        else window.scrollTo(0, 0);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
