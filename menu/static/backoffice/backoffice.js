/* Back office (/admin/shop/): side-menu drawer, the order/expense sheets (modal on wide screens), qty stepper, chart
   tooltips. Every form still works without this file; it only makes them nicer. */
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const side = $('#side'), sveil = $('#sveil')
  const drawer = (on) => { side?.classList.toggle('on', on); sveil?.classList.toggle('on', on) }
  $('#burger')?.addEventListener('click', () => drawer(true))
  sveil?.addEventListener('click', () => drawer(false))

  // sheets
  const veil = $('#veil')
  let open = null
  const close = () => { open?.classList.remove('on'); veil?.classList.remove('on'); open = null }
  window.openSheet = (id, opts = {}) => {
    const el = document.getElementById(id)
    if (!el) return
    close()
    open = el
    if (id === 'order') {
      const pre = !!opts.pre
      el.querySelector(`input[name=kind][value=${pre ? 'pre' : 'now'}]`).checked = true
      if (opts.date) el.querySelector('#pDate').value = opts.date
      else if (!el.querySelector('#pDate').value) {
        const t = new Date(Date.now() + 86400000)
        el.querySelector('#pDate').value = t.toLocaleDateString('sv')
      }
    }
    el.classList.add('on'); veil.classList.add('on')
    setTimeout(() => el.querySelector(opts.focus || 'input:not([type=hidden]):not([type=radio])')?.focus?.({ preventScroll: true }), 250)
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]')
    if (b) { e.preventDefault(); openSheet(b.dataset.open, { pre: b.dataset.pre === '1', date: b.dataset.date }) }
    if (e.target.closest('[data-x]')) close()
  })
  veil?.addEventListener('click', close)
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); drawer(false) } })

  // qty stepper + total
  const qty = $('#qty'), qtyIn = $('#qtyIn'), total = $('#oTotal'), prod = $('#oProduct')
  const price = () => +(prod?.selectedOptions?.[0]?.dataset.price ?? prod?.dataset.price ?? 0)
  const paint = () => { if (total) total.textContent = '฿' + (qtyIn.value * price()).toLocaleString('th-TH') }
  document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    qtyIn.value = Math.max(1, +qtyIn.value + +b.dataset.q); qty.textContent = qtyIn.value; paint()
  }))
  prod?.addEventListener('change', paint)
  if (qtyIn) paint()

  // chart tooltips (each bar group carries data-tip)
  document.querySelectorAll('.card .chart').forEach((svg) => {
    const card = svg.closest('.card'), tip = document.createElement('div')
    tip.className = 'tip'; card.appendChild(tip)
    const show = (e) => {
      const g = e.target.closest('[data-tip]')
      if (!g) { tip.style.opacity = 0; return }
      const r = g.getBoundingClientRect(), c = card.getBoundingClientRect(), s = svg.getBoundingClientRect()
      tip.textContent = g.dataset.tip
      tip.style.left = r.left - c.left + r.width / 2 + 'px'
      tip.style.top = s.top - c.top + 10 + 'px'
      tip.style.opacity = 1
    }
    svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show)
    svg.addEventListener('pointerleave', () => (tip.style.opacity = 0))
  })

  // phone filter sheet on the orders page
  $('#fbtn')?.addEventListener('click', () => openSheet('fsheet'))
})()
