import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import BankApp from './BankApp.jsx'
import Panel from './Panel.jsx'
import './theme.css'

// HashRouter so /panel deep-links work when served as plain static files
// (no server-side rewrites) and survive path-prefix proxies.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<BankApp />} />
        <Route path="/panel" element={<Panel />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
