import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import BankApp from './BankApp.jsx'
import Panel from './Panel.jsx'
import AnimLab from './AnimLab.jsx'
import HeroSite from './HeroSite.jsx'
import HeroSite2 from './HeroSite2.jsx'
import './theme.css'

// HashRouter so /panel deep-links work when served as plain static files
// (no server-side rewrites) and survive path-prefix proxies.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<BankApp />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/lab" element={<AnimLab />} />
        <Route path="/hero" element={<HeroSite />} />
        <Route path="/hero2" element={<HeroSite2 />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
