const TIME_ZONE = 'Asia/Bangkok'

function getDeliveryDayKey() {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date())

  return ['Mon', 'Tue', 'Wed'].includes(weekday) ? 'thursday' : 'monday'
}

function syncDeliveryDay() {
  document.documentElement.dataset.deliveryDay = getDeliveryDayKey()
}

syncDeliveryDay()
window.setInterval(syncDeliveryDay, 60 * 1000)
