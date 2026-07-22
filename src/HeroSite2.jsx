import {
  Mark, useReveal, NavBar, ProblemSection, ScenariosSection, ShieldsSection,
  OnDeviceSection, NetworkSection, ScaleSection, SiteFooter,
} from './HeroSite.jsx'

// #/hero2 — the Higgsfield-art variant of the hero site. Same content as
// #/hero (one source of truth), skinned with generated cinematic imagery:
// full-bleed hero backdrop, photographic scenario cards, on-device product
// render. Assets live in public/hero2/ (bundled locally — offline-safe).

const IMG = {
  hero: 'hero2/hero-bg.png',
  ondevice: 'hero2/ondevice.png',
  scenarios: {
    grandparent: 'hero2/grandparent.png',
    remote: 'hero2/remote.png',
    impaired: 'hero2/impaired.png',
    workout: 'hero2/workout.png',
  },
}

export default function HeroSite2() {
  const heroRef = useReveal()
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="hero-site hero2">
      <NavBar go={go} />

      <header className="hs-hero hs2-hero hs-section" ref={heroRef}>
        <div className="hs2-hero-bg" aria-hidden="true">
          <img
            src={IMG.hero}
            alt=""
            onError={(e) => e.currentTarget.remove()}
          />
          <span className="hs2-hero-shade" />
        </div>
        <div className="hs2-hero-content">
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
          <div className="hs-scroll-cue"><i /><span>SCROLL</span></div>
        </div>
      </header>

      <ProblemSection go={go} />
      <ScenariosSection images={IMG.scenarios} />
      <ShieldsSection />
      <OnDeviceSection image={IMG.ondevice} />
      <NetworkSection />
      <ScaleSection />
      <SiteFooter />
    </div>
  )
}
