// Centered device chrome for projector display; collapses to full-viewport
// below 520px (see theme.css) so the app stays responsive on real phones.
export default function PhoneFrame({ children }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="phone-screen">
          <div className="phone-notch" />
          <div className="statusbar">
            <span>9:41</span>
            <span className="sb-icons">
              <svg width="17" height="11" viewBox="0 0 17 11">
                <rect x="0" y="7" width="3" height="4" rx="0.8" fill="#111" />
                <rect x="4.5" y="5" width="3" height="6" rx="0.8" fill="#111" />
                <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" fill="#111" />
                <rect x="13.5" y="0" width="3" height="11" rx="0.8" fill="#111" />
              </svg>
              <svg width="16" height="11" viewBox="0 0 16 12">
                <path d="M8 9.5 L9.8 11.3 A2.6 2.6 0 0 0 6.2 11.3 Z" fill="#111" />
                <path d="M3.5 7 A6.4 6.4 0 0 1 12.5 7" fill="none" stroke="#111" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M1 4.2 A10 10 0 0 1 15 4.2" fill="none" stroke="#111" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <svg width="25" height="12" viewBox="0 0 25 12">
                <rect x="0.7" y="0.7" width="21" height="10.6" rx="3" fill="none" stroke="#111" strokeWidth="1.1" />
                <rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="#111" />
                <path d="M23.3 4 v4 a2.2 2.2 0 0 0 0 -4" fill="#111" />
              </svg>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
