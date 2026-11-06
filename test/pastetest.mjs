import { launch, BASE, PHONE } from './common.mjs'
const b = await launch(); const c = await b.newContext(PHONE)
await c.addInitScript(() => { window.LogosAndroid = { clipboard: () => 'Hello there. This is a paste test for Logos. It should start playing by itself.' } })
const p = await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(BASE); await p.waitForTimeout(5000)
const btn = p.locator('button[aria-label*="aste" i]').first(); console.log('paste btns', await p.locator('button[aria-label*="aste" i]').count())
await btn.click()
for (let i=0;i<20;i++){ await p.waitForTimeout(3000); const t = await p.evaluate(()=>document.body.innerText); if (/Pause|Playing|Reading/i.test(t) || document) { const lab = await p.evaluate(()=>[...document.querySelectorAll('button[aria-label]')].map(x=>x.getAttribute('aria-label')).join(',')); if (/Pause/.test(lab)) { console.log('PLAYING after', (i+1)*3,'s'); break } if(i==19) console.log('labels', lab, t.slice(0,300)) } }
console.log('errors', errs); await b.close()
