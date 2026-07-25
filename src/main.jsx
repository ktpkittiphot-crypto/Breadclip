import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './logo.css'
import './hide-hero-bio.css'
import './admin-guard.js'
import './promptpay-lock.js'
import './coupon-safety.js'
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

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Bread Clip UI error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main style={{ maxWidth: 560, margin: '60px auto', padding: 20, textAlign: 'center', fontFamily: 'Prompt, sans-serif', color: '#4c2f23' }}>
        <section style={{ padding: 28, border: '1px solid #eadaca', borderRadius: 20, background: '#fff' }}>
          <h1 style={{ marginTop: 0 }}>ระบบขัดข้องชั่วคราว</h1>
          <p>ข้อมูลในแบบฟอร์มยังไม่ถูกส่ง กรุณารีเฟรชหน้าแล้วลองอีกครั้ง</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ width: '100%', padding: 14, border: 0, borderRadius: 14, background: '#4c2f23', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
          >
            โหลดหน้าเว็บใหม่
          </button>
        </section>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
