import AppRouter from './router/AppRouter';

import {
  AuthProvider
} from './auth/AuthProvider';

import {
  SystemAlertModal
} from './components/SystemAlertModal';

function App() {

  return (

    <AuthProvider>

      <AppRouter />

      <SystemAlertModal />

    </AuthProvider>
  );
}

export default App;
