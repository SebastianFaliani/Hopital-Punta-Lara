import { Navigate } from 'react-router-dom';

import { getDefaultPath } from './permissions';
import { useAuth } from './useAuth';

export default function HomeRedirect() {
  const { user } = useAuth();

  return (
    <Navigate
      to={getDefaultPath(user)}
      replace
    />
  );
}
