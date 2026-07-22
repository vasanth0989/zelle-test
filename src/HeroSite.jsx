import { useEffect, useRef, useState } from 'react'
import { INSTRUMENTS, ShieldChip } from './RiskPanel.jsx'
import { DEMO_SCENARIOS } from './demoScenarios.js'

// One Shield hero site (#/hero) — the keynote-grade public page. Captures the
// full pitch (problem → scenarios → shields → on-device → network) and embeds
// the REAL product instruments live inside the shield cards.
// Sections are exported so #/hero2 (Higgsfield-art variant) composes the same
// content with richer visuals — one source of truth, two skins.

export function Mark({ size = 30 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2l8 3.2v6.2c0 5-3.4 8.7-8 10.6-4.6-1.9-8-5.6-8-10.6V5.2L12 2z" fill="#e0393e" />
      <path d="M12 5.2l5 2v4.4c0 3.3-2.1 5.9-5 7.3-2.9-1.4-5-4-5-7.3V7.2l5-2z" fill="#fff" opacity="0.94" />
      <path d="M12 8l2.6 1v2.4c0 1.8-1.1 3.2-2.6 4-1.5-.8-2.6-2.2-2.6-4V9l2.6-1z" fill="#e0393e" />
    </svg>
  )
}

// Scroll-reveal: adds .in when the element enters the viewport.
export function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.18 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

export function CountTo({ value, prefix = '', suffix = '' }) {
  const ref = useRef(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const dur = 1400
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur)
        setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.6 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>
}

export const SHIELD_CARDS = [
  {
    key: 'biometric',
    name: 'Biometric Shield',
    color: '#ff8d92',
    question: 'Is this person’s body showing stress or fear?',
    onDevice: true,
    signals: ['Heart rate vs. personal resting baseline', 'HRV — suppressed under duress', 'Skin temperature delta', 'Activity state — exertion vs. stationary', 'Any connected wearable — watch, band, ring'],
  },
  {
    key: 'behavior',
    name: 'Presence Shield',
    color: '#c3b1ff',
    question: 'Is the real, undisturbed account holder in control?',
    onDevice: true,
    signals: ['Typing cadence vs. customer profile', 'Mouse / touch path linearity', 'Hesitation before confirmation', 'Answer pacing on verification questions'],
  },
  {
    key: 'context',
    name: 'Geo Shield',
    color: '#8fe0ae',
    question: 'Does this place and moment make sense?',
    onDevice: false,
    signals: ['Semantic place type — not just coordinates', 'Time of day vs. active payment window', 'Distance from home and typical locations', 'Reasons iteratively over location history'],
  },
  {
    key: 'transaction',
    name: 'Transaction Shield',
    color: '#9dc7ff',
    question: 'Does this payment fit the financial fingerprint?',
    onDevice: false,
    signals: ['Amount vs. customer’s typical range', 'Payee novelty — first time vs. known', 'Payment velocity in last 24h', 'Rail irreversibility weighting'],
  },
]

const TIMELINE = [
  { key: 'biometric', label: 'Biometric', verdict: 'stress 82', tone: 'alert' },
  { key: 'behavior', label: 'Presence', verdict: 'human 15', tone: 'ok' },
  { key: 'context', label: 'Geo', verdict: 'setting 55', tone: 'alert' },
  { key: 'transaction', label: 'Transaction', verdict: '10× limit', tone: 'alert' },
]

export function Section({ id, eyebrow, title, sub, children, className = '' }) {
  const ref = useReveal()
  return (
    <section id={id} className={`hs-section ${className}`} ref={ref}>
      {eyebrow && <p className="hs-eyebrow">{eyebrow}</p>}
      {title && <h2 className="hs-h2">{title}</h2>}
      {sub && <p className="hs-sub">{sub}</p>}
      {children}
    </section>
  )
}

export function NavBar({ go }) {
  return (
    <nav className="hs-nav">
      <span className="hs-brand">
        <Mark size={24} />
        <b>One Shield</b>
        <i>by Capital One</i>
      </span>
      <span className="hs-links">
        <button onClick={() => go('problem')}>The Problem</button>
        <button onClick={() => go('scenarios')}>Scenarios</button>
        <button onClick={() => go('shields')}>Shields</button>
        <button onClick={() => go('ondevice')}>On-Device</button>
        <button onClick={() => go('network')}>Network</button>
      </span>
      <a className="hs-cta sm" href="#/">Launch live demo</a>
    </nav>
  )
}

export function ProblemSection({ go }) {
  return (
    <Section
      id="problem"
      eyebrow="THE PROBLEM"
      title={<>Fraud systems watch payments.<br />Scammers learned to use people.</>}
      sub="Authorized Push Payment fraud makes the customer send the money. Every existing system approves it — because the transaction looks normal."
    >
      <div className="hs-stats">
        <div className="hs-stat"><b><CountTo value={10} prefix="$" suffix="B" /></b><span>lost annually to authorized fraud in the US</span></div>
        <div className="hs-stat"><b><CountTo value={100} suffix="%" /></b><span>of these transactions were approved by fraud systems</span></div>
        <div className="hs-stat"><b><CountTo value={0} /></b><span>existing systems that check if the customer is under duress</span></div>
      </div>
      <div className="hs-quote">
        <p>Fraud systems were built to answer one question:</p>
        <h3>“Does this transaction look normal?”</h3>
        <p>One Shield asks four questions no system has ever asked — and answers them in under four seconds, before the money moves.</p>
      </div>
      <div className="hs-timeline">
        {TIMELINE.map((t, i) => (
          <div key={t.key} className={`hs-tl-step tone-${t.tone}`} style={{ transitionDelay: `${0.25 + i * 0.35}s` }}>
            <ShieldChip shield={t.key} />
            <b>{t.label}</b>
            <span>{t.verdict}</span>
          </div>
        ))}
        <div className="hs-tl-step verdict" style={{ transitionDelay: '1.8s' }}>
          <b>Verify the human</b>
          <span>3.8s · before the money moved</span>
        </div>
      </div>
    </Section>
  )
}

export function ScenariosSection({ images = null }) {
  return (
    <Section
      id="scenarios"
      eyebrow="REAL SCENARIOS"
      title="Every one of these was approved by existing systems."
    >
      <div className="hs-cards">
        {DEMO_SCENARIOS.filter((s) => ['grandparent', 'remote', 'impaired', 'workout'].includes(s.key)).map((s) => (
          <div key={s.key} className={`hs-scard tone-${s.tone}${images ? ' with-img' : ''}`}>
            {images && (
              <div className="hs-scard-img">
                <img
                  src={images[s.key]}
                  alt=""
                  loading="lazy"
                  onError={(e) => e.currentTarget.closest('.hs-scard-img')?.remove()}
                />
              </div>
            )}
            <div className="hs-scard-body">
              <span className={`sr-tag tone-${s.tone}`}>{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.story}</p>
              <div className="hs-scard-foot">
                <span className={`sr-expect exp-${s.expect.replace(' ', '')}`}>{s.expect}</span>
                <span className="hs-scard-amt">{'$' + s.amount.toLocaleString()} · {s.rail}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function ShieldsSection() {
  return (
    <Section
      id="shields"
      eyebrow="THE ARCHITECTURE"
      title={<>Four shields.<br />One adjudicator.</>}
      sub="Each shield reasons independently. The adjudicator weighs convergence — one high score is noise; independent signals agreeing is coercion. These readouts are the real product, running live."
    >
      <div className="hs-shields">
        {SHIELD_CARDS.map((s) => {
          const Instrument = INSTRUMENTS[s.key]
          return (
            <div key={s.key} className="hs-shield">
              <div className="hs-shield-head">
                <ShieldChip shield={s.key} />
                <h3 style={{ color: s.color }}>{s.name}</h3>
              </div>
              <p className="hs-shield-q">{s.question}</p>
              <ul>
                {s.signals.map((sig, i) => <li key={i}>{sig}</li>)}
              </ul>
              <div className="hs-shield-inst"><Instrument /></div>
              {s.onDevice && <p className="hs-shield-star">ON DEVICE — DATA NEVER LEAVES THE PHONE</p>}
            </div>
          )
        })}
      </div>
    </Section>
  )
}

export function OnDeviceSection({ image = null }) {
  const pipeline = (
    <>
      <div className="hs-pipeline">
        <div className="hs-pipe-node">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="6" width="10" height="12" rx="3" /><path d="M9.5 3.5h5M9.5 20.5h5" /><path d="M9.7 12.6l1.5 1.6 3-3.4" /></svg>
          <b>Wearable</b>
          <span>HR · HRV · skin temp · activity state</span>
          <i className="hs-badge">ANY DEVICE</i>
        </div>
        <span className="hs-pipe-arrow">→</span>
        <div className="hs-pipe-node hot">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M9.5 17.5h5" /><circle cx="12" cy="10" r="3" /></svg>
          <b>On-Device Gemma</b>
          <span>Reasons over signals ephemerally. Score only — no raw data sent.</span>
          <i className="hs-badge">NEVER LEAVES PHONE</i>
        </div>
        <span className="hs-pipe-arrow">→</span>
        <div className="hs-pipe-node">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 18.5H7a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.2 11a3.8 3.8 0 0 1-.7 7.5z" /></svg>
          <b>One Shield API</b>
          <span>Receives score + confidence. Raw health data: never.</span>
          <i className="hs-badge">SCORE ONLY</i>
        </div>
      </div>
      <p className="hs-greenstrip">✓ Analyzed in the moment · discarded after · never stored · never transmitted</p>
    </>
  )
  return (
    <Section
      id="ondevice"
      eyebrow="PRIVACY BY DESIGN"
      title={<>Your health data<br />never leaves your device.</>}
      sub="A Gemma-class on-device model pre-scores biometric risk before the transaction reaches the server. Ephemeral processing — analyzed and discarded in the same moment."
    >
      {image ? (
        <div className="hs-od-split">
          <div className="hs-od-img">
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={(e) => e.currentTarget.closest('.hs-od-img')?.remove()}
            />
          </div>
          <div className="hs-od-pipe">{pipeline}</div>
        </div>
      ) : pipeline}
    </Section>
  )
}

export function NetworkSection() {
  return (
    <Section
      id="network"
      eyebrow="THE CAPITAL ONE ADVANTAGE"
      title={<>A network signal<br />no fintech can replicate.</>}
      sub="Capital One co-owns Early Warning Services — the cross-bank intelligence network behind Zelle. One Shield consults live scam signals across every member bank, on any payment rail, at the moment of the transaction."
    >
      <div className="hs-network">
        <svg className="hs-net-line" viewBox="0 0 700 8" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 4 H700" />
        </svg>
        <div className="hs-net-node"><b>Chase</b><span>Coerced payment flagged 10:45 PM</span></div>
        <div className="hs-net-node"><b>Wells Fargo</b><span>Same payee flagged 10:52 PM</span></div>
        <div className="hs-net-node hot"><b>EWS Network</b><span>Live cross-bank scam intelligence</span></div>
        <div className="hs-net-node red"><b>Capital One</b><span>One Shield queries at 11:04 PM → PAUSE</span></div>
      </div>
      <div className="hs-quote tight">
        <p>
          <b>A payee flagged for coercion at another bank minutes ago is a payee
          One Shield already knows about.</b> That is a capability no fintech
          can build — because Capital One co-owns the network.
        </p>
      </div>
    </Section>
  )
}

export function ScaleSection() {
  return (
    <Section
      id="scale"
      eyebrow="BUILT TO SCALE"
      title="Every new phone makes it stronger."
      sub="The coordinator runs on the device — 70% of payments never touch a server. When One Shield escalates, the adjudicator runs server-side, where the EWS network lives. Coordination on device. Reasoning where the data is."
      className="hs-scale"
    >
      <div className="hs-cta-row center">
        <a className="hs-cta" href="#/">Launch the live demo</a>
      </div>
    </Section>
  )
}

export function SiteFooter() {
  return (
    <footer className="hs-footer">
      <Mark size={18} />
      <span>One Shield · Capital One Bank Tech Hackathon 2026 · Built in 48 hours</span>
    </footer>
  )
}

export default function HeroSite() {
  const heroRef = useReveal()
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="hero-site">
      <NavBar go={go} />

      <header className="hs-hero hs-section" ref={heroRef}>
        <p className="hs-eyebrow">CAPITAL ONE · BANK TECH HACKATHON 2026</p>
        <h1 className="hs-h1">The bank that<br /><span>sees you.</span></h1>
        <p className="hs-sub big">
          One Shield is the first payment protection system that reads the
          person behind the transaction — not just the transaction.
        </p>
        <p className="hs-fact">
          <b>$10 billion</b> stolen last year from Americans through authorized
          fraud. Every bank approved it.
        </p>
        <div className="hs-cta-row">
          <button className="hs-cta" onClick={() => go('shields')}>See how it works</button>
          <a className="hs-cta ghost" href="#/">Launch the live demo</a>
        </div>

        <div className="hs-orbit" aria-hidden="true">
          <span className="hs-orbit-glow" />
          <span className="hs-orbit-core"><Mark size={64} /></span>
          <span className="hs-orbit-ring r1" /><span className="hs-orbit-ring r2" />
          <div className="hs-orbit-spin">
            {SHIELD_CARDS.map((s, i) => (
              <span key={s.key} className={`hs-orb o${i}`}>
                <span className="hs-orb-chip"><ShieldChip shield={s.key} /></span>
              </span>
            ))}
          </div>
        </div>
        <div className="hs-scroll-cue"><i /><span>SCROLL</span></div>
      </header>

      <ProblemSection go={go} />
      <ScenariosSection />
      <ShieldsSection />
      <OnDeviceSection />
      <NetworkSection />
      <ScaleSection />
      <SiteFooter />
    </div>
  )
}
