import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './logo.css'
import './hide-hero-bio.css'
import './admin-guard.js'
import './promptpay-lock.js'
import './coupon-safety.js'

const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw4DwcxpK_EBxfaLezs1q37j7gay2tLpamiPZzYobW8YeYrV79b5JQ_OFJENR-nOMmH/exec'
const PROMPTPAY_ID = '1679900640970'
const FORM_MODE_KEY = 'breadclip_admin_form_mode'
const VALID_FORM_MODES = ['auto', 'open', 'closed']

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

async function loadGlobalFormMode() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 4500)

  try {
    const separator = BACKEND_URL.includes('?') ? '&' : '?'
    const response = await fetch(`${BACKEND_URL}${separator}action=getFormStatus&_=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    const result = await response.json()

    if (result.ok && VALID_FORM_MODES.includes(result.formMode)) {
      localStorage.setItem(FORM_MODE_KEY, result.formMode)
    }
  } catch (error) {
    console.warn('Unable to load global preorder status; using the last saved mode.', error)
  } finally {
    window.clearTimeout(timeout)
  }
}

async function bootstrap() {
  const rootElement = document.getElementById('root')
  rootElement.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;font-family:Prompt,sans-serif;color:#4c2f23"><p>กำลังโหลดสถานะรับออเดอร์…</p></main>'

  await loadGlobalFormMode()
  const { default: App } = await import('./App.jsx')

  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
}

bootstrap().catch((error) => {
  console.error('Bread Clip startup error:', error)
  const rootElement = document.getElementById('root')
  rootElement.innerHTML = `
    <main style="max-width:560px;margin:60px auto;padding:20px;text-align:center;font-family:Prompt,sans-serif;color:#4c2f23">
      <section style="padding:28px;border:1px solid #eadaca;border-radius:20px;background:#fff">
        <h1>โหลดหน้าเว็บไม่สำเร็จ</h1>
        <p>กรุณากดโหลดใหม่อีกครั้ง</p>
        <button onclick="window.location.reload()" style="width:100%;padding:14px;border:0;border-radius:14px;background:#4c2f23;color:#fff;font:inherit;font-weight:700;cursor:pointer">โหลดหน้าเว็บใหม่</button>
      </section>
    </main>`
})