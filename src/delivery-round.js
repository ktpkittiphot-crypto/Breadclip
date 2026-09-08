const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

function getBangkokWeekday() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: BANGKOK_TIME_ZONE,
  }).format(new Date())
}

function getDeliveryDay() {
  const weekday = getBangkokWeekday()
  return ['Mon', 'Tue', 'Wed'].includes(weekday) ? 'พฤหัสบดี' : 'จันทร์'
}

function setTextIfChanged(element, text) {
  if (element && element.textContent !== text) element.textContent = text
}

function removeOldCouponConditionText() {
  document.querySelectorAll('.card small').forEach((element) => {
    const text = String(element.textContent || '').trim()
    if (text.startsWith('kittiphotandfriend ต้องมียอดขนมครบ')) element.remove()
  })
}

function updateDeliveryRoundMessages() {
  const deliveryDay = getDeliveryDay()
  const hero = document.querySelector('.hero')

  if (hero) {
    const heroMain = [...hero.querySelectorAll('p')].find((element) =>
      element.dataset.deliveryRoundMain === 'true' ||
      String(element.textContent || '').includes('เปิดพรีออเดอร์') ||
      String(element.textContent || '').includes('รอบส่งวันจันทร์และพฤหัสบดี')
    )

    if (heroMain) {
      heroMain.dataset.deliveryRoundMain = 'true'
      setTextIfChanged(heroMain, `รอบส่งวันจันทร์และพฤหัสบดี • ออเดอร์วันนี้ส่งวัน${deliveryDay}`)
    }

    let scheduleNote = hero.querySelector('[data-delivery-round-note]')
    if (!scheduleNote) {
      scheduleNote = document.createElement('small')
      scheduleNote.dataset.deliveryRoundNote = 'true'
      const firstSmall = hero.querySelector('small')
      if (firstSmall) hero.insertBefore(scheduleNote, firstSmall)
      else hero.appendChild(scheduleNote)
    }
    setTextIfChanged(scheduleNote, 'จันทร์–พุธ → ส่งวันพฤหัสบดี • พฤหัสบดี–อาทิตย์ → ส่งวันจันทร์')
  }

  const checkoutCard = document.querySelector('.checkout-card')
  if (checkoutCard) {
    let roundMessage = checkoutCard.querySelector('[data-current-delivery-round]')
    if (!roundMessage) {
      roundMessage = document.createElement('p')
      roundMessage.dataset.currentDeliveryRound = 'true'
      roundMessage.className = 'status success'
      roundMessage.style.margin = '8px 0 12px'
      const heading = checkoutCard.querySelector('h2')
      if (heading) heading.insertAdjacentElement('afterend', roundMessage)
      else checkoutCard.prepend(roundMessage)
    }
    setTextIfChanged(roundMessage, `ออเดอร์รอบนี้ส่งวัน${deliveryDay}`)
  }

  const successCard = document.querySelector('.success-card')
  if (successCard) {
    const successRound = [...successCard.querySelectorAll('p')].find((element) =>
      String(element.textContent || '').includes('รอรับขนมวัน')
    )
    setTextIfChanged(successRound, `รอรับขนมวัน${deliveryDay}นะครับ 🍰`)
  }

  removeOldCouponConditionText()
}

let scheduled = false
function scheduleUpdate() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(() => {
    scheduled = false
    updateDeliveryRoundMessages()
  })
}

const observer = new MutationObserver(scheduleUpdate)

function startDeliveryRoundSync() {
  updateDeliveryRoundMessages()
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setInterval(updateDeliveryRoundMessages, 60 * 1000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startDeliveryRoundSync, { once: true })
} else {
  startDeliveryRoundSync()
}
