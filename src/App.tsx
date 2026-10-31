import { useEffect } from 'react'
import { useRoute } from './lib/router.ts'
import { useStore } from './lib/store.ts'
import { settings, applyTheme } from './lib/settings.ts'
import { listen, installMediaSession } from './player/listen.ts'
import { isModelCached, ensureModel, lastLoadCrashed, purgeUnusedModels } from './engine/engine.ts'
import { refreshLibrary } from './lib/library.ts'
import { BottomNav, SideRail, StatusPill, MiniPlayer, BrandMark } from './components/chrome.tsx'
import { Toasts } from './components/ui.tsx'
import { ListenPage } from './pages/ListenPage.tsx'
import { CreatePage } from './pages/CreatePage.tsx'
import { LibraryPage } from './pages/LibraryPage.tsx'
import { VoicesPage } from './pages/VoicesPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'

const PAGES = { listen: ListenPage, create: CreatePage, library: LibraryPage, voices: VoicesPage, settings: SettingsPage }

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
    void refreshLibrary()
    // Model already on this device? Warm it up in the background (offline-ready).
    // Skipped when the last start never finished (the tab crashed), so a bad
    // load can never turn into a reload loop; play still loads it on demand.
    void purgeUnusedModels()
    if (!lastLoadCrashed()) void isModelCached().then((cached) => { if (cached) ensureModel().catch(() => {}) })
  }, [])

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
          <main key={route} className="page-host" style={{ display: 'contents' }}>
            <PageWrap mini={showMini}><Page /></PageWrap>
          </main>
        </div>
      </div>
      <MiniPlayer />
      <BottomNav />
      <Toasts />
    </>
  )
}

function PageWrap({ mini, children }: { mini: boolean; children: React.ReactNode }) {
  // Pages render their own `.page` root; add bottom room when the mini player shows.
  useEffect(() => {
    document.querySelectorAll('.page').forEach((el) => el.classList.toggle('has-mini', mini))
  })
  return <>{children}</>
}
