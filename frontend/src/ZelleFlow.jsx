import { useEffect, useRef, useState } from 'react'
import { KNOWN_PAYEES, formatUsd, makeConfirmationCode, deriveEnrolledName } from './data.js'
import {
  ZelleBadge, ReviewBadge, SuccessBadge, ShieldBadge, PauseShieldBadge,
  HeartShieldBadge, ZelleGlyph, InfoDot, BlueInfoDot, PrinterIcon,
} from './icons.jsx'
import { startRecorder, summarize } from './telemetry.js'
import { evaluate, respond } from './api.js'
import RiskPanel from './RiskPanel.jsx'

const CHALLENGE_QUESTIONS = [
  { key: 'contacted', text: 'Did someone contact you unexpectedly and ask you to make this payment?' },
  { key: 'guided', text: 'Is anyone guiding you through this payment right now — by phone, chat, or remote-access software?' },
  { key: 'known', text: 'Have you met this recipient in person?' },
]

// Zelle send flow: form → review → evaluating (shield panel) → routed by the
// adjudication: allow → success · step_up/questions → challenge ·
// step_up/temporary_biometric_permission → grant → re-run · pause → hold.
// Telemetry is captured live from modal-open; results come from the mock module
// (api.js) until the Phase 4 backend lands.
export default function ZelleFlow({ balance, biometricConsent, displayMode = 'live', onClose, onSent }) {
  const [step, setStep] = useState('form')

  // form state
  const [recipient, setRecipient] = useState('')
  const [chosenPayee, setChosenPayee] = useState(null) // known payee object, or null
  const [amount, setAmount] = useState('')
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // evaluation state (v2 wire format: step / result / adjudication events)
  const [results, setResults] = useState({})
  const [shieldSteps, setShieldSteps] = useState({})
  const [adjudication, setAdjudication] = useState(null)
  const [challengeAnswers, setChallengeAnswers] = useState({})
  const [confirmationCode, setConfirmationCode] = useState('')
  const [evalError, setEvalError] = useState(false)
  // Mid-run consent ask (v2.1): popup over the streaming panel; the
  // Adjudicator holds its verdict until the customer answers.
  const [runId, setRunId] = useState(null)
  const [consentRequest, setConsentRequest] = useState(null)
  const [consentAnswered, setConsentAnswered] = useState(false)

  const recorder = useRef(null)
  const reviewShownAt = useRef(0)
  const payloadRef = useRef(null)
  const cancelMock = useRef(null)

  useEffect(() => {
    recorder.current = startRecorder()
    return () => {
      recorder.current.stop()
      cancelMock.current?.()
    }
  }, [])

  useEffect(() => {
    if (step === 'review') reviewShownAt.current = performance.now()
  }, [step])

  const amountNum = parseFloat(amount) || 0

  const matchedKnown = KNOWN_PAYEES.find(
    (p) =>
      p.contact.toLowerCase() === recipient.trim().toLowerCase() ||
      p.name.toLowerCase() === recipient.trim().toLowerCase(),
  )
  const isNewRecipient = recipient.trim() !== '' && !chosenPayee && !matchedKnown

  // "Enrolled as" resolves automatically, like the real Zelle directory lookup.
  const payeeName = chosenPayee?.name ?? matchedKnown?.name ?? deriveEnrolledName(recipient)
  const payeeContact = chosenPayee?.contact ?? matchedKnown?.contact ?? recipient.trim()
  const payeeFirstSeen = !(chosenPayee || matchedKnown)

  const formValid = recipient.trim() !== '' && amountNum > 0 && amountNum <= balance

  function pickPayee(p) {
    setChosenPayee(p)
    setRecipient(p.contact)
  }

  function handleRecipientChange(v) {
    setRecipient(v)
    setChosenPayee(null)
  }

  function finalizeSuccess() {
    setConfirmationCode(makeConfirmationCode())
    onSent({ amount: amountNum, payeeName })
    setStep('success')
  }

  // No auto-advance: the analysis panel is the demo centerpiece, so it holds
  // until the presenter/customer taps Continue (same in LIVE and spinner mode).
  function proceedFromPanel() {
    const adj = adjudication
    if (!adj) return
    if (adj.decision === 'allow') finalizeSuccess()
    else if (adj.decision === 'step_up') {
      setStep(adj.step_up_method === 'temporary_biometric_permission' ? 'grant' : 'challenge')
    } else setStep('paused')
  }

  function handleEvent(evt) {
    if (evt.type === 'run_started') {
      setRunId(evt.run_id)
    } else if (evt.type === 'consent_request') {
      setConsentRequest(evt)
    } else if (evt.type === 'step') {
      setShieldSteps((prev) => ({
        ...prev,
        [evt.shield]: [...(prev[evt.shield] || []), evt.text],
      }))
    } else if (evt.type === 'result') {
      setResults((prev) => ({ ...prev, [evt.shield]: evt }))
    } else if (evt.type === 'adjudication') {
      setAdjudication(evt)
    }
  }

  function startEvaluation(payload) {
    payloadRef.current = payload
    console.log('[NeuroSecure] Evaluate payload →', JSON.stringify(payload, null, 2))
    setResults({})
    setShieldSteps({})
    setAdjudication(null)
    setEvalError(false)
    setRunId(null)
    setConsentRequest(null)
    setConsentAnswered(false)
    setStep('evaluating')
    cancelMock.current = evaluate(payload, handleEvent, () => setEvalError(true))
  }

  function answerConsentRequest(grant) {
    setConsentAnswered(true)
    respond(runId, grant).catch(() => setEvalError(true))
  }

  function handleSend() {
    startEvaluation({
      transaction: {
        amount: amountNum,
        payee: payeeName,
        payee_first_seen: payeeFirstSeen,
        channel: 'zelle',
        memo: memo.trim() || null,
      },
      telemetry: summarize(recorder.current, reviewShownAt.current),
      consent: { biometrics: biometricConsent === true },
    })
  }

  function handleGrantTemporary() {
    // One-time grant: full re-run with temporary biometric consent.
    startEvaluation({
      ...payloadRef.current,
      consent: { biometrics: true, temporary: true },
    })
  }

  function handleDeclineOffer() {
    // Offer ignored: the Adjudicator re-decides from the three available
    // signals. Shield results stay on screen; only the verdict refreshes.
    const payload = {
      ...payloadRef.current,
      consent: { biometrics: false, offer_declined: true },
    }
    payloadRef.current = payload
    console.log('[NeuroSecure] One-time offer declined, re-adjudicating →', JSON.stringify(payload.consent))
    setAdjudication(null)
    setStep('evaluating')
    cancelMock.current = evaluate(payload, handleEvent)
  }

  function handleChallengeContinue() {
    const payload = { ...payloadRef.current, challenge_passed: true }
    console.log('[NeuroSecure] Challenge passed, re-submitting →', JSON.stringify(payload.transaction))
    setStep('sending')
    cancelMock.current = evaluate(
      payload,
      (evt) => {
        if (evt.type === 'adjudication') finalizeSuccess()
      },
      () => { setEvalError(true); setStep('evaluating') },
    )
  }

  const challengeComplete = CHALLENGE_QUESTIONS.every((q) => challengeAnswers[q.key])

  return (
    <>
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        {step === 'form' && (
          <>
            <div className="modal-art"><ZelleBadge /></div>
            <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
            <h2>Send money with Zelle®</h2>
            <p className="sub">Make sure you know and trust the person.</p>

            <div className="tabs">
              <button className="tab active">Send money</button>
              <button className="tab">Request money</button>
            </div>

            <div className="field">
              <div className="field-label-row">
                <label>To email or phone number <InfoDot size={13} /></label>
              </div>
              <input
                name="recipient"
                placeholder="name@email.com or 123-456-7890"
                value={recipient}
                onChange={(e) => handleRecipientChange(e.target.value)}
              />
            </div>

            {recipient.trim() === '' && !chosenPayee && (
              <div className="payee-list">
                {KNOWN_PAYEES.map((p) => (
                  <button key={p.id} className="payee-item" onClick={() => pickPayee(p)}>
                    <ZelleGlyph size={15} />
                    <span>
                      <span className="p-name">{p.display}</span>
                      <br />
                      <span className="p-sub">{p.contact}</span>
                    </span>
                    <span className="p-tag">Last paid {p.lastPaid}</span>
                  </button>
                ))}
              </div>
            )}

            {isNewRecipient && (
              <div className="hint neutral">First time sending to this recipient.</div>
            )}

            <div className="field">
              <div className="field-label-row">
                <label>Amount</label>
                <span className="avail">{formatUsd(balance)} Available</span>
              </div>
              <input
                name="amount"
                inputMode="decimal"
                placeholder="$ 0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
              {amountNum > balance && (
                <div className="hint">Amount exceeds your available balance.</div>
              )}
            </div>

            {memoOpen ? (
              <div className="field">
                <div className="field-label-row"><label>Memo</label></div>
                <input
                  name="memo"
                  placeholder="What's it for?"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            ) : (
              <button className="memo-toggle" onClick={() => setMemoOpen(true)}>+ Add memo</button>
            )}

            <button
              className="btn-continue"
              disabled={!formValid}
              onClick={() => { setAcknowledged(false); setStep('review') }}
            >
              Continue
            </button>
          </>
        )}

        {(step === 'review' || step === 'sending') && (
          <>
            <div className="modal-art"><ReviewBadge /></div>
            {step === 'review' && (
              <button className="modal-back" aria-label="Back" onClick={() => setStep('form')}>←</button>
            )}
            <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
            <h2>Review &amp; send</h2>

            {step === 'sending' ? (
              <div className="spin-wrap"><div className="spinner" /></div>
            ) : (
              <>
                <div className="review-rows">
                  <div className="review-row">
                    <span className="r-label">Send to</span>
                    <span className="r-value">{payeeContact}</span>
                  </div>
                  <div className="review-row">
                    <span className="r-label">Enrolled as</span>
                    <span className="r-value"><ZelleGlyph size={13} /> {payeeName.toUpperCase()}</span>
                  </div>
                  <div className="review-row">
                    <span className="r-label">Amount</span>
                    <span className="r-value">{formatUsd(amountNum)}</span>
                  </div>
                  <div className="review-row">
                    <span className="r-label">From account</span>
                    <span className="r-value">360 Checking ...1164</span>
                  </div>
                  {memo.trim() && (
                    <div className="review-row">
                      <span className="r-label">Memo</span>
                      <span className="r-value">{memo}</span>
                    </div>
                  )}
                </div>

                <div className="info-box">
                  <span className="ib-icon"><BlueInfoDot /></span>
                  <span>
                    <strong>There is no purchase protection if you buy goods or services
                    with Zelle®.</strong>{' '}
                    Watch out for common scams when purchasing items or sending money
                    after unexpected calls.
                  </span>
                </div>

                <label className="confirm-check">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  <span>I understand that Zelle® payments cannot be canceled once delivered.</span>
                </label>

                <button
                  className={`btn-send${acknowledged ? ' armed' : ''}`}
                  disabled={!acknowledged}
                  onClick={handleSend}
                >
                  Send money
                </button>
              </>
            )}
          </>
        )}

        {step === 'evaluating' && (
          <>
            <div className="modal-art"><ShieldBadge /></div>
            <h2>Checking your payment</h2>
            {evalError ? (
              <div className="eval-error">
                <p>We couldn't reach the security service. Your payment has not been sent.</p>
                <button className="btn-continue" onClick={() => startEvaluation(payloadRef.current)}>
                  Try again
                </button>
                <button className="btn-cancel-link" onClick={onClose}>Cancel this payment</button>
              </div>
            ) : displayMode === 'spinner' && !adjudication ? (
              <>
                <div className="spin-wrap"><div className="spinner" /></div>
                <p className="rp-sub">Reviewing this transfer securely…</p>
              </>
            ) : (
              <RiskPanel
                results={results}
                steps={shieldSteps}
                adjudication={adjudication}
                instant={displayMode === 'spinner'}
                onProceed={proceedFromPanel}
              />
            )}
          </>
        )}

        {step === 'grant' && (
          <>
            <div className="modal-art"><HeartShieldBadge size={54} /></div>
            <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
            <h2>One quick safeguard</h2>
            <p className="challenge-msg">{adjudication?.customer_message}</p>
            <div className="paused-note">
              <BlueInfoDot />
              <span>One-time reading. Analyzed now, never stored.</span>
            </div>
            <button className="btn-continue btn-stacked" onClick={handleGrantTemporary}>
              Allow one-time access &amp; send now
              <span className="btn-sub">Fastest option — usually just seconds.</span>
            </button>
            <button className="btn-cancel-link" onClick={handleDeclineOffer}>
              Not now — we’ll verify another way (may take longer)
            </button>
            <button className="btn-cancel-link muted" onClick={onClose}>
              Cancel this payment
            </button>
          </>
        )}

        {step === 'challenge' && (
          <>
            <div className="modal-art"><ShieldBadge tone="#c78500" /></div>
            <h2>Before this goes through…</h2>
            <p className="challenge-msg">{adjudication?.customer_message}</p>
            <div className="challenge-qs">
              {CHALLENGE_QUESTIONS.map((q) => (
                <div className="challenge-q" key={q.key}>
                  <p>{q.text}</p>
                  <div className="cq-options">
                    {['Yes', 'No'].map((opt) => (
                      <label key={opt} className={challengeAnswers[q.key] === opt ? 'picked' : ''}>
                        <input
                          type="radio"
                          name={`cq-${q.key}`}
                          checked={challengeAnswers[q.key] === opt}
                          onChange={() => setChallengeAnswers((a) => ({ ...a, [q.key]: opt }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn-continue"
              disabled={!challengeComplete}
              onClick={handleChallengeContinue}
            >
              Continue with this payment
            </button>
            <button className="btn-cancel-link" onClick={onClose}>
              Cancel this payment
            </button>
          </>
        )}

        {step === 'paused' && (
          <>
            <div className="modal-art"><PauseShieldBadge /></div>
            <h2>This payment is on hold</h2>
            <p className="paused-msg">{adjudication?.customer_message}</p>
            <div className="paused-note">
              <BlueInfoDot />
              <span>No money has left your account.</span>
            </div>
            <button className="btn-continue" onClick={onClose}>Back to my account</button>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="modal-art"><SuccessBadge /></div>
            <button className="modal-x" aria-label="Close" onClick={onClose}>✕</button>
            <div className="success-head"><h2>Success</h2></div>
            <p className="success-msg">
              All done! You've sent {formatUsd(amountNum)} to<br />
              {payeeContact}
              <br />
              The money will typically be available in minutes.
            </p>
            <div className="review-rows">
              <div className="review-row">
                <span className="r-label">Sent to</span>
                <span className="r-value">{payeeContact}</span>
              </div>
              <div className="review-row">
                <span className="r-label">Enrolled as</span>
                <span className="r-value"><ZelleGlyph size={13} /> {payeeName.toUpperCase()}</span>
              </div>
              <div className="review-row">
                <span className="r-label">Amount</span>
                <span className="r-value">{formatUsd(amountNum)}</span>
              </div>
              <div className="review-row">
                <span className="r-label">From account</span>
                <span className="r-value">360 Checking ...1164</span>
              </div>
            </div>
            <div className="conf-code">
              <span className="cc-spacer" aria-hidden="true" />
              <span className="cc-text">
                <span className="cc-value">{confirmationCode}</span>
                <br />
                <span className="cc-label">CONFIRMATION CODE</span>
              </span>
              <button className="cc-print" aria-label="Print confirmation">
                <PrinterIcon />
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {step === 'evaluating' && consentRequest && !consentAnswered && !evalError && (
      // Sibling of the modal, anchored to the phone screen — stays pinned to
      // the bottom while shield events keep streaming (and growing the modal).
      <div className="consent-ask">
        <div className="consent-ask-card">
          <div className="ca-head">
            <HeartShieldBadge size={38} />
            <strong>One quick safeguard</strong>
          </div>
          <p>{consentRequest.message}</p>
          <button
            className="btn-continue btn-stacked"
            onClick={() => answerConsentRequest(true)}
          >
            Allow one-time access &amp; send now
            <span className="btn-sub">Fastest option — usually just seconds.</span>
          </button>
          <button className="btn-cancel-link" onClick={() => answerConsentRequest(false)}>
            Not now — we’ll verify another way (may take longer)
          </button>
          <button className="btn-cancel-link muted" onClick={onClose}>
            Cancel this payment
          </button>
        </div>
      </div>
    )}
    </>
  )
}
