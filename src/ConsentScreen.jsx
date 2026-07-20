import { HeartShieldBadge } from './icons.jsx'

// First-run consent screen (v2): grants health-data use for payment protection.
// "Allow while using app" pattern; consent lives in React state only.
export default function ConsentScreen({ onDecide }) {
  return (
    <div className="consent-screen">
      <div className="consent-body">
        <HeartShieldBadge size={72} />
        <h2>Help us protect your payments</h2>
        <p>
          To spot signs of fraud or coercion at the moment you pay, this app can
          read wellness signals — like heart rate — from your connected wearable
          while you use the app.
        </p>
        <p className="consent-em">
          Readings are analyzed in the moment and never stored. We analyze,
          never keep.
        </p>
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
