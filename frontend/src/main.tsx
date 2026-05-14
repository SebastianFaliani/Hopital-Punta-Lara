import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './styles/global.css';
import './styles/variables.css';
import './styles/buttons.css';
import './styles/forms.css';
import './styles/modal.css';
import './styles/auth.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
