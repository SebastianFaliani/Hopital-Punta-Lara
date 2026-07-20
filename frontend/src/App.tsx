import AppRouter from './router/AppRouter';

import {
  AuthProvider
} from './auth/AuthProvider';

import {
  SystemAlertModal
} from './components/SystemAlertModal';
import UppercaseInputNormalizer
  from './components/UppercaseInputNormalizer';

function App() {

  return (

    <AuthProvider>

      <UppercaseInputNormalizer />

      <AppRouter />

      <SystemAlertModal />

    </AuthProvider>
  );
}

export default App;
