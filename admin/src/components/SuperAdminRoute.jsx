import { Navigate, Outlet } from 'react-router-dom';
import { getAdminSession, homePathFor } from '../lib/adminSession';

// Pages only the super admin can use. District admins are sent to the review
// queue (the API would reject their requests on these pages anyway).
const SuperAdminRoute = () => {
  const session = getAdminSession();

  if (session && !session.isSuperAdmin) {
    return <Navigate to={homePathFor(session)} replace />;
  }

  return <Outlet />;
};

export default SuperAdminRoute;
