import { useEffect, useState } from 'react'
import PhoneFrame from './PhoneFrame.jsx'
import ZelleFlow from './ZelleFlow.jsx'
import ConsentScreen from './ConsentScreen.jsx'
import {
  ACCOUNT, PROMOS, UPCOMING_TRANSACTIONS, PAST_TRANSACTIONS, formatUsd,
} from './data.js'
import {
  BankLogo, ZelleGlyph, HelpBubble, AvatarIcon, InfoDot, BlueInfoDot,
  CalendarIcon, BillIcon, StatementIcon, PlusCircleIcon, SearchIcon,
  PersonCircleIcon,
} from './icons.jsx'

// Promo banners hidden per Shantanu (Jul 20) — flip to true to bring them back.
const SHOW_PROMOS = false

export default function BankApp() {
  const [balance, setBalance] = useState(ACCOUNT.startingBalance)
  const [pastTxns, setPastTxns] = useState(PAST_TRANSACTIONS)
  const [promos, setPromos] = useState(PROMOS)
  const [zelleOpen, setZelleOpen] = useState(false)
  // null = not asked yet (first-run consent screen shows); true/false afterwards.
  // React state only — a reload re-asks, which is exactly right for the demo.
  const [biometricConsent, setBiometricConsent] = useState(null)
  // Display mode + developer overlay are set from the control panel tab over
  // BroadcastChannel (in-memory cross-tab messaging — no-storage rule holds).
  const [displayMode, setDisplayMode] = useState('live')
  const [devMode, setDevMode] = useState(false)

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
      { date: 'Jul 20', description: payeeName.toUpperCase(), category: 'Zelle Money Sent', amount: -amount, balance: newBalance },
      ...pastTxns,
    ])
  }

  return (
    <PhoneFrame>
      <div className="app-scroll">
        <header className="app-header">
          <div className="hdr-left">
            <button className="hdr-back" aria-label="Back">‹</button>
          </div>
          <div className="hdr-center"><BankLogo /></div>
          <div className="hdr-right">
            <button className="hdr-help"><HelpBubble /> Help</button>
            <button className="hdr-avatar" aria-label="Profile">
              <AvatarIcon />
              <span className="hdr-caret">▾</span>
            </button>
          </div>
        </header>

        <section className="hero">
          <button className="chev left" aria-label="Previous account">‹</button>
          <button className="chev right" aria-label="Next account">›</button>
          <h1>{ACCOUNT.name}</h1>
          <div className="acct-num">{ACCOUNT.numberMasked}</div>
          <div className="acct-links">
            <button className="acct-link">▭ VIEW DEBIT CARD</button>
            <button className="acct-link"><InfoDot size={12} /> VIEW ACCOUNT DETAILS ›</button>
          </div>
          <div className="bal-label">AVAILABLE BALANCE</div>
          <div className="bal">
            <span className="cur">$</span>
            {Math.floor(balance).toLocaleString('en-US')}
            <sup>{String(Math.round((balance % 1) * 100)).padStart(2, '0')}</sup>
          </div>
          <button className="transfer-btn">Transfer Money</button>
        </section>

        {SHOW_PROMOS && (
        <section className="promos">
          {promos.map((p, i) => (
            <div className="promo-row" key={i}>
              <span>{p.text}<a href="#/">{p.link}</a></span>
              <button
                className="promo-x"
                aria-label="Dismiss"
                onClick={() => setPromos(promos.filter((_, j) => j !== i))}
              >✕</button>
            </div>
          ))}
        </section>
        )}

        <nav className="quick-actions">
          <button className="qa-btn" onClick={() => setZelleOpen(true)}>
            <span className="zelle-mark"><ZelleGlyph size={19} color="#0276b1" /></span>
            Send money with Zelle®
          </button>
          <button className="qa-btn"><BillIcon /> Bill pay</button>
          <button className="qa-btn"><StatementIcon /> Statements</button>
          <button className="qa-btn"><PlusCircleIcon /> More</button>
        </nav>

        <section className="section">
          <div className="section-title">
            Upcoming Transactions <span className="title-info"><InfoDot /></span>
          </div>
          <div className="card">
            {UPCOMING_TRANSACTIONS.map((t, i) => (
              <div key={i}>
                <div className="txn-datebar">{t.date}</div>
                <div className="txn-row">
                  <CalendarIcon />
                  <div className="txn-main">
                    <div className="txn-desc">{t.description}</div>
                    <div className="txn-cat">{t.category}</div>
                  </div>
                  <div className="txn-right">
                    <div className="txn-amt">{formatUsd(t.amount)}</div>
                    <div className="txn-status">{t.status}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head-row">
            <div className="section-title">
              Past Transactions <span className="title-info"><InfoDot /></span>
            </div>
            <button className="link-btn">⭳ Download</button>
          </div>
          <div className="search-row">
            <div className="search-box">
              <SearchIcon />
              <input placeholder="Search amount, date, check # or transaction description" />
            </div>
            <button className="filter-btn">Filter</button>
          </div>
          <div className="card">
            {pastTxns.map((t, i) => (
              <div key={i}>
                <div className="txn-datebar">{t.date}</div>
                <div className="txn-row">
                  <PersonCircleIcon />
                  <div className="txn-main">
                    <div className="txn-desc">{t.description}</div>
                    <div className="txn-cat">{t.category}</div>
                  </div>
                  <div className="txn-right">
                    <div className={`txn-amt${t.amount > 0 ? ' credit' : ''}`}>
                      {t.amount > 0 ? '+' : ''}{formatUsd(t.amount)}
                    </div>
                    <div className="txn-bal">{formatUsd(t.balance)}</div>
                  </div>
                </div>
              </div>
            ))}
            <button className="view-more">View More Transactions</button>
          </div>
          <p className="fine-print" style={{ marginTop: 12 }}>
            To help you identify your purchases, we may provide additional information
            about your transactions, including the company name, address, phone number,
            marks, and logos. This additional information might not be accurate and does
            not imply any affiliation between this bank and the company. Always refer to
            the original transaction descriptions that appear on your statement.
          </p>
        </section>

        <section className="section">
          <div className="card debit-card-block">
            <h3>Your debit card</h3>
            <p>
              Manage places where your debit card is stored, including digital wallets,
              recurring payments and frequent charges.
            </p>
            <button className="btn-primary">View debit card</button>
          </div>
        </section>

        <footer className="app-footer">
          <div className="footer-links">
            <span>PRODUCTS</span><span>› ABOUT US</span><span>CAREERS</span><span>› LEGAL</span>
            <span>HELP</span><span>CONTACT US</span><span>PRIVACY</span><span>SECURITY</span>
          </div>
          <p className="fine">
            To help you identify your purchases, additional transaction information may
            be provided. Always refer to the original descriptions on your statement.
          </p>
        </footer>

      </div>

      {biometricConsent === null && (
        <ConsentScreen onDecide={setBiometricConsent} />
      )}

      {zelleOpen && (
        <ZelleFlow
          balance={balance}
          biometricConsent={biometricConsent}
          displayMode={displayMode}
          devMode={devMode}
          onClose={() => setZelleOpen(false)}
          onSent={handleSent}
        />
      )}
    </PhoneFrame>
  )
}
