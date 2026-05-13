import AppRouter from './router/AppRouter';

import {
  AuthProvider
} from './auth/AuthProvider';

function App() {

  return (

    <AuthProvider>

      <AppRouter />

    </AuthProvider>
  );
}

export default App;