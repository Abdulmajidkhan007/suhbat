import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import FullscreenLoader from '../ui/FullscreenLoader';

interface Props {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { user, initialized } = useAppSelector((s) => s.auth);
  const location = useLocation();

  if (!initialized) return <FullscreenLoader message="Authenticating…" />;
  if (!user)        return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
