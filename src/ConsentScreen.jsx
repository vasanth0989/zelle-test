import { HeartShieldBadge } from './icons.jsx'

const BLUE = '#0276b1'

function PulseIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l3-8 4 16 3-8h6" />
    </svg>
  )
}

function DeviceLockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M9.5 15.5l2 2 3.5-4" />
    </svg>
  )
}

function VanishIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
      <path d="M4.5 19.5L19.5 4.5" />
    </svg>
  )
}

// First-run consent screen (v3): grants health-data use for payment
// protection. "Allow while using app" pattern; consent lives in React state
// only. The on-device promise is the headline, not the fine print.
export default function ConsentScreen({ onDecide }) {
  return (
    <div className="consent-screen">
      <div className="consent-body">
        <div className="consent-hero">
          <span className="consent-ring" aria-hidden="true"><span /><span /></span>
          <HeartShieldBadge size={72} />
        </div>
        <div className="consent-pill-row">
          <span className="ondevice-pill">ON THIS DEVICE</span>
        </div>
        <h2>Help us protect your payments</h2>
        <p>
          At the moment you pay, this app can spot signs of fraud or coercion —
          using intelligence that lives on your phone.
        </p>

        <div className="consent-features">
          <div className="consent-feature">
            <span className="cf-icon"><PulseIcon /></span>
            <span>
              <span className="cf-title">Wellness signals, read in the moment</span>
              <span className="cf-sub">
                Heart rate and breathing from your connected wearable — only
                while you use the app.
              </span>
            </span>
          </div>
          <div className="consent-feature">
            <span className="cf-icon"><DeviceLockIcon /></span>
            <span>
              <span className="cf-title">Analyzed on this device only</span>
              <span className="cf-sub">
                Everything runs right here on your phone. Your health data
                never leaves it — nothing is sent to our servers.
              </span>
            </span>
          </div>
          <div className="consent-feature">
            <span className="cf-icon"><VanishIcon /></span>
            <span>
              <span className="cf-title">Never stored</span>
              <span className="cf-sub">
                Checked at the moment you pay, then gone. We analyze, never keep.
              </span>
            </span>
          </div>
        </div>

        <button className="btn-continue" onClick={() => onDecide(true)}>
          Allow while using app
        </button>
        <button className="btn-cancel-link" onClick={() => onDecide(false)}>
          Don’t allow
        </button>
        <p className="consent-fine">
          You can change this anytime in Settings. <a href="#/">Terms &amp; Conditions</a>
        </p>
      </div>
    </div>
  )
}
