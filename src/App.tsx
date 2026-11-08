import { useEffect, useLayoutEffect } from 'react'
import { useRoute } from './lib/router.ts'
import { useStore } from './lib/store.ts'
import { settings, applyTheme } from './lib/settings.ts'
import { listen, installMediaSession } from './player/listen.ts'
import { initBubble } from './lib/bubble.ts'
import { isModelCached, ensureModel, lastLoadCrashed, removeLegacyEngine } from './engine/engine.ts'
import { refreshLibrary } from './lib/library.ts'
import { BottomNav, SideRail, StatusPill, MiniPlayer, BrandMark } from './components/chrome.tsx'
import { Toasts } from './components/ui.tsx'
import { sweepTempBooks } from './lib/books.ts'
import { KeepAskSheet } from './components/shelf.tsx'
import { ListenPage } from './pages/ListenPage.tsx'
import { CreatePage } from './pages/CreatePage.tsx'
import { LibraryPage } from './pages/LibraryPage.tsx'
import { VoicesPage } from './pages/VoicesPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { BookPage } from './pages/BookPage.tsx'

const PAGES = { listen: ListenPage, create: CreatePage, library: LibraryPage, voices: VoicesPage, settings: SettingsPage, book: BookPage }

export default function App() {
  const route = useRoute()
  const st = useStore(settings)
  const s = useStore(listen)

  useEffect(() => { applyTheme(st.theme) }, [st.theme])
  useEffect(() => {
    if (st.theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [st.theme])

  useEffect(() => {
    installMediaSession()
    initBubble()
    void refreshLibrary()
    void sweepTempBooks()
    // Model already on this device? Warm it up in the background (offline-ready).
    // Skipped when the last start never finished (the tab crashed), so a bad
    // load can never turn into a reload loop; play still loads it on demand.
    void removeLegacyEngine()
    if (!lastLoadCrashed()) void isModelCached().then((cached) => { if (cached) ensureModel().catch(() => {}) })
  }, [])

  // Immersive listening (phone): while Listen plays, the bottom nav slides away and
  // the player glides into its space. Hiding waits a beat so a quick play/pause tap
  // never starts an animation; showing is immediate. Ended, errors (playing goes
  // false) and leaving Listen all bring the nav back.
  const immersive = route === 'listen' && s.playing && !s.error
  useEffect(() => {
    const root = document.documentElement
    if (!immersive) { delete root.dataset.immersive; return }
    // The player only glides down when it is docked at the bottom of the screen
    // (sticky); when the page is short and it sits in the flow, it stays put.
    const dock = () => {
      const c = document.querySelector<HTMLElement>('.listen-page .player-card')
      if (!c) return
      const ty = new DOMMatrixReadOnly(getComputedStyle(c).transform === 'none' ? undefined : getComputedStyle(c).transform).m42
      const navTop = document.querySelector('.nav')?.getBoundingClientRect().height ?? 0
      const bottom = c.getBoundingClientRect().bottom - ty
      const docked = bottom >= innerHeight - navTop - 40
      if (docked) root.dataset.dock = '1'; else delete root.dataset.dock
    }
    const t = setTimeout(() => { dock(); root.dataset.immersive = '1' }, 220)
    addEventListener('scroll', dock, { passive: true })
    addEventListener('resize', dock)
    return () => { clearTimeout(t); removeEventListener('scroll', dock); removeEventListener('resize', dock) }
  }, [immersive])

  const Page = PAGES[route]
  const showMini = s.active && route !== 'listen' && (s.playing || s.current > 0 || s.mode !== null)
  return (
    <>
      <div className="aurora" />
      <div className="grain" />
      <div className="shell">
        <SideRail />
        <div className="main">
          <header className="topbar">
            <a className="brand" href="#/listen" aria-label="Logos home"><BrandMark /><span className="brand-name">Logos</span></a>
            <div className="spacer" />
            <StatusPill />
          </header>
          <main key={route === 'book' ? location.hash : route} className="page-host" style={{ display: 'contents' }}>
            <PageWrap mini={showMini}><Page /></PageWrap>
          </main>
        </div>
      </div>
      <MiniPlayer />
      <BottomNav />
      <Toasts />
      <KeepAskSheet />
    </>
  )
}

function PageWrap({ mini, children }: { mini: boolean; children: React.ReactNode }) {
  // Pages render their own `.page` root; add bottom room when the mini player shows.
  useEffect(() => {
    document.querySelectorAll('.page').forEach((el) => el.classList.toggle('has-mini', mini))
  })
  // Very long pages (Voices) skip the blur in their entrance: a blurred layer that tall is
  // too big for phone GPUs and the screen jumps while it settles.
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('.page').forEach((el) => { if (!el.dataset.sized) { el.dataset.sized = '1'; el.classList.toggle('long', el.scrollHeight > innerHeight * 2.2) } })
  })
  return <>{children}</>
}
