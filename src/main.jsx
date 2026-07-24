import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './logo.css'
import App from './App.jsx'

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyJSHTGFeJOQVoMGk5lxEblPyJ080L3dWKlJ5rhQN-2vprbSF_RWQ2gOKYMG_KiATSq/exec'

try {
  const saved = localStorage.getItem('breadclip_settings')
  const settings = saved ? JSON.parse(saved) : {}
  localStorage.setItem('breadclip_settings', JSON.stringify({
    ...settings,
    backendUrl: BACKEND_URL,
  }))
} catch (error) {
  console.warn('Unable to save Bread Clip backend URL.', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
