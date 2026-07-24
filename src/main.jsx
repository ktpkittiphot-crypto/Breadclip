import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './logo.css'
import './hide-hero-bio.css'
import './admin-guard.js'
import './promptpay-lock.js'
import App from './App.jsx'

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyJSHTGFeJOQVoMGk5lxEblPyJ080L3dWKlJ5rhQN-2vprbSF_RWQ2gOKYMG_KiATSq/exec'
const PROMPTPAY_ID = '1679900640970'

try {
  const saved = localStorage.getItem('breadclip_settings')
  const settings = saved ? JSON.parse(saved) : {}
  localStorage.setItem('breadclip_settings', JSON.stringify({
    ...settings,
    backendUrl: BACKEND_URL,
    promptpayId: PROMPTPAY_ID,
  }))
} catch (error) {
  console.warn('Unable to save Bread Clip system settings.', error)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
