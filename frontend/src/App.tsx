import AppRouter from './router/AppRouter';

import {
  AuthProvider
} from './auth/AuthProvider';

import {
  SystemAlertModal
} from './components/SystemAlertModal';
import UppercaseInputNormalizer
  from './components/UppercaseInputNormalizer';
import AppUpdateModal
  from './components/AppUpdateModal';

function App() {

  return (

    <AuthProvider>

      <UppercaseInputNormalizer />

      <AppRouter />

      <AppUpdateModal />

      <SystemAlertModal />

    </AuthProvider>
  );
}

export default App;
