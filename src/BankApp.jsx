import { useEffect, useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import ZelleFlow from './ZelleFlow.jsx'
import ConsentScreen from './ConsentScreen.jsx'
import { DEMO_SCENARIOS } from './demoScenarios.js'
import { setScenario as apiSetScenario } from './api.js'
import { PACING } from './RiskPanel.jsx'
import { ZelleGlyph } from './icons.jsx'
import {
  ACCOUNT, UPCOMING_TRANSACTIONS, PAST_TRANSACTIONS, formatUsd,
} from './data.js'

// Scenario glyphs: consistent stroked SVG chips instead of emoji — enterprise
// finish per Jul 22 feedback.
function ScenarioGlyph({ k }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" {...p} aria-hidden="true">
      {k === 'grandparent' && (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      )}
      {k === 'remote' && (<>
        <rect x="2" y="3" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 16v5" />
      </>)}
      {k === 'impaired' && (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      )}
      {k === 'workout' && (
        <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
      )}
      {k === 'normal' && (<>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.2l2.4 2.4 4.6-5" />
      </>)}
      {k === 'no_consent' && (<>
        <rect x="4" y="11" width="16" height="10" rx="2.5" />
        <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      </>)}
    </svg>
  )
}

// Thin-line action icons for the "I want to..." grid (real-app style).
function ActionIcon({ k }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...p} aria-hidden="true">
      {k === 'bills' && (<>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </>)}
      {k === 'transfer' && (<>
        <path d="M4 8h14l-3-3" />
        <path d="M20 16H6l3 3" />
      </>)}
      {k === 'deposit' && (<>
        <rect x="3" y="6" width="18" height="14" rx="2.5" />
        <circle cx="12" cy="13" r="4" />
        <path d="M8 6l1.2-2h5.6L16 6" />
      </>)}
      {k === 'lock' && (<>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>)}
      {k === 'statements' && (<>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5" />
      </>)}
    </svg>
  )
}

// Bottom tab bar icons.
function TabIcon({ k }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" {...p} aria-hidden="true">
      {k === 'home' && (<>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
      </>)}
      {k === 'rewards' && (<>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M5 12v8h14v-8M12 8v12" />
        <path d="M12 8c-4 0-4.5-5-1.5-5S12 8 12 8zm0 0c4 0 4.5-5 1.5-5S12 8 12 8z" />
      </>)}
      {k === 'paymove' && (<>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M12 8.5v7M14.2 10a2.4 2.4 0 0 0-2.2-1c-1.2 0-2.1.6-2.1 1.6 0 2.4 4.4.8 4.4 3.1 0 1-1 1.7-2.3 1.7a2.6 2.6 0 0 1-2.3-1.1" />
      </>)}
      {k === 'help' && (<>
        <path d="M21 12a9 9 0 1 0-3.5 7.1L21 20l-.8-3.2A8.96 8.96 0 0 0 21 12z" />
        <path d="M9.8 9.8a2.3 2.3 0 0 1 4.5.7c0 1.5-2.2 1.8-2.2 3.2M12 16.6h.01" />
      </>)}
      {k === 'profile' && (<>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.8 20.2c.9-3.4 3.8-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
      </>)}
    </svg>
  )
}

export default function BankApp() {
  const [balance, setBalance] = useState(ACCOUNT.startingBalance)
  const [pastTxns, setPastTxns] = useState(PAST_TRANSACTIONS)
  const [zelleOpen, setZelleOpen] = useState(false)
  // Consent defaults to granted — the first-run disclosure no longer blocks
  // the demo (Shantanu, Jul 22: "that will take up time"). It appears only
  // when the Privacy Choice scenario is selected (null = screen shows).
  const [biometricConsent, setBiometricConsent] = useState(true)
  // Display mode + developer overlay are set from the control panel tab over
  // BroadcastChannel (in-memory cross-tab messaging — no-storage rule holds).
  const [displayMode, setDisplayMode] = useState('live')
  const [devMode, setDevMode] = useState(false)
  // Demo scenario carousel (beside the phone): selecting a story card drives
  // the mock backend AND prefills the send flow — one tap to run on stage.
  const [scenario, setScenarioCard] = useState(null)
  // Presenter pacing (⚙ in the rail header) — writes through to the module
  // PACING that the analysis sheet reads live.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pacing, setPacing] = useState({ ...PACING })

  function updatePacing(patch) {
    Object.assign(PACING, patch)
    setPacing({ ...PACING })
  }

  function pickScenario(card) {
    const next = scenario?.key === card.key ? null : card
    setScenarioCard(next)
    apiSetScenario(next ? next.key : 'normal').catch(() => {})
    // The privacy beat starts at the consent screen; every other scenario
    // (and deselecting) skips it.
    setBiometricConsent(next?.key === 'no_consent' ? null : true)
  }

  useEffect(() => {
    const ch = new BroadcastChannel('neurosecure-ctl')
    ch.onmessage = (e) => {
      if (e.data?.type === 'display_mode') setDisplayMode(e.data.mode)
      if (e.data?.type === 'dev_mode') setDevMode(e.data.on === true)
    }
    ch.postMessage({ type: 'request_mode' }) // catch up if the panel is already open
    return () => ch.close()
  }, [])

  function handleSent({ amount, payeeName }) {
    const newBalance = balance - amount
    setBalance(newBalance)
    setPastTxns([
      { date: 'Jul 22', description: payeeName.toUpperCase(), category: 'Zelle Money Sent', amount: -amount, balance: newBalance },
      ...pastTxns,
    ])
  }

  const actions = [
    { k: 'bills', label: 'Pay bills' },
    { k: 'transfer', label: 'Transfer' },
    { k: 'zelle', label: 'Send money with Zelle®' },
    { k: 'deposit', label: 'Deposit' },
    { k: 'lock', label: 'Lock card' },
    { k: 'statements', label: 'View statements' },
  ]

  return (
    <div className="demo-layout">
      <aside className="scenario-rail">
        <div className="sr-head">
          <div className="sr-head-row">
            <span className="sr-eyebrow">REAL SCENARIOS</span>
            <button
              className="sr-gear"
              aria-label="Presentation pacing"
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="rp-settings sr-settings">
                <div className="rps-row">
                  <label>Message pace</label>
                  <input
                    type="range" min="400" max="5000" step="100"
                    value={pacing.lineMs}
                    onChange={(e) => updatePacing({ lineMs: Number(e.target.value) })}
                  />
                  <span className="rps-val">{(pacing.lineMs / 1000).toFixed(1)}s / line</span>
                </div>
                <div className="rps-row">
                  <label>Shield hand-off</label>
                  <input
                    type="range" min="2000" max="12000" step="500"
                    value={pacing.dwellMs}
                    onChange={(e) => updatePacing({ dwellMs: Number(e.target.value) })}
                  />
                  <span className="rps-val">{(pacing.dwellMs / 1000).toFixed(1)}s / shield</span>
                </div>
              </div>
            )}
          </div>
          <h2>Every one of these was approved by existing systems.</h2>
        </div>
        {DEMO_SCENARIOS.map((card) => (
          <button
            key={card.key}
            className={`sr-card tone-${card.tone}${scenario?.key === card.key ? ' active' : ''}`}
            onClick={() => pickScenario(card)}
          >
            <span className="sr-top">
              <span className={`sr-icon tone-${card.tone}`}><ScenarioGlyph k={card.key} /></span>
              <span className={`sr-tag tone-${card.tone}`}>{card.tag}</span>
            </span>
            <span className="sr-title">{card.title}</span>
            <span className="sr-story">{card.story}</span>
            <span className="sr-meta">
              {formatUsd(card.amount)} · {card.rail}
              <span className={`sr-expect exp-${card.expect.replace(' ', '')}`}>{card.expect}</span>
            </span>
          </button>
        ))}
        <p className="sr-hint">
          {scenario
            ? `Armed: tap “Send money with Zelle®” on the phone — the run is one tap.`
            : 'Pick a scenario, then send from the phone.'}
        </p>
      </aside>
      <PhoneFrame>
      <div className="app-scroll cap-home">
        <header className="ch-hero">
          <button className="ch-back" aria-label="Back">‹</button>
          <div className="ch-acct">360 Checking <span className="ch-acct-num">...1164</span></div>
          <div className="ch-balance">{formatUsd(balance)}</div>
          <div className="ch-bal-label">Available balance</div>
          <div className="ch-rule" />
          <div className="ch-current">{formatUsd(balance)}</div>
          <div className="ch-bal-label">Current balance <span className="ch-info">ⓘ</span></div>
        </header>

        <section className="ch-card">
          <div className="ch-card-head">I want to...</div>
          <div className="ch-grid">
            {actions.map((a) => (
              <button
                key={a.k}
                className="ch-action"
                onClick={a.k === 'zelle' ? () => setZelleOpen(true) : undefined}
              >
                <span className="ch-action-icon">
                  {a.k === 'zelle' ? <ZelleGlyph size={20} color="#141414" /> : <ActionIcon k={a.k} />}
                </span>
                <span className="ch-action-label">{a.label}</span>
              </button>
            ))}
          </div>
          <div className="ch-card-foot"><button className="ch-link">View all</button></div>
        </section>

        <section className="ch-card">
          <div className="ch-card-head row">
            Upcoming transactions
            <button className="ch-link">View all</button>
          </div>
          {UPCOMING_TRANSACTIONS.length === 0 && (
            <p className="ch-empty">You don’t have any upcoming transactions.</p>
          )}
          {UPCOMING_TRANSACTIONS.map((t, i) => (
            <div className="ch-txn" key={i}>
              <div className="ch-txn-main">
                <div className="ch-txn-desc">{t.description}</div>
                <div className="ch-txn-cat">{t.category} · {t.status}</div>
              </div>
              <div className="ch-txn-right">
                <span className="ch-txn-amt">{formatUsd(Math.abs(t.amount))}</span>
                <span className="ch-txn-chev">›</span>
              </div>
            </div>
          ))}
        </section>

        <section className="ch-card">
          <div className="ch-card-head row">
            Recent transactions
            <button className="ch-link">View all</button>
          </div>
          {pastTxns.slice(0, 6).map((t, i) => (
            <div key={i}>
              {(i === 0 || pastTxns[i - 1].date !== t.date) && (
                <div className="ch-dateband">{t.date}</div>
              )}
              <div className="ch-txn">
                <div className="ch-txn-main">
                  <div className="ch-txn-desc">{t.description}</div>
                  <div className="ch-txn-cat">{t.category}</div>
                </div>
                <div className="ch-txn-right">
                  <span className="ch-txn-amt">{formatUsd(Math.abs(t.amount))}</span>
                  <span className="ch-txn-chev">›</span>
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="ch-tab-spacer" />
      </div>

      <nav className="ch-tabbar" aria-label="App navigation">
        {[
          { k: 'home', label: 'Home', active: true },
          { k: 'rewards', label: 'Rewards' },
          { k: 'paymove', label: 'Pay/Move' },
          { k: 'help', label: 'Help' },
          { k: 'profile', label: 'Profile' },
        ].map((t) => (
          <button key={t.k} className={`ch-tab${t.active ? ' active' : ''}`}>
            <TabIcon k={t.k} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {biometricConsent === null && (
        <ConsentScreen onDecide={setBiometricConsent} />
      )}

      {zelleOpen && (
        <ZelleFlow
          key={scenario ? scenario.key : 'manual'}
          balance={balance}
          biometricConsent={biometricConsent}
          displayMode={displayMode}
          devMode={devMode}
          scenario={scenario}
          onClose={() => setZelleOpen(false)}
          onSent={handleSent}
        />
      )}
      </PhoneFrame>
    </div>
  )
}
