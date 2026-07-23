import AppRouter from './router/AppRouter';

import {
  AuthProvider
} from './auth/AuthProvider';

import {
  SystemAlertModal
} from './components/SystemAlertModal';
import { SystemConfirmModal } from './components/SystemConfirmModal';
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

      <SystemConfirmModal />

    </AuthProvider>
  );
}

export default App;
