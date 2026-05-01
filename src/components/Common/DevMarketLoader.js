import React, { useState, useEffect } from 'react';

export function DevMarketLoader() {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [dots, setDots] = useState([true, false, false]);

  const steps = [
    { icon: '🔌', label: 'Connecting to Supabase...' },
    { icon: '📡', label: 'Loading marketplace data...' },
    { icon: '🚀', label: 'Preparing DevMarket...' }
  ];

  useEffect(() => {
    const pInterval = setInterval(() => setProgress(p => p >= 90 ? p : p + Math.random() * 15), 400);
    const sInterval = setInterval(() => setActiveStep(s => s < steps.length - 1 ? s + 1 : s), 1500);
    const dInterval = setInterval(() => {
      setDots(prev => {
        const next = prev.findIndex(d => d) + 1;
        if (next >= prev.length) return [true, false, false];
        return prev.map((_, i) => i === next);
      });
    }, 500);
    const timeout = setTimeout(() => { setProgress(100); setActiveStep(steps.length - 1); }, 4000);

    return () => {
      clearInterval(pInterval);
      clearInterval(sInterval);
      clearInterval(dInterval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="dm-loader">
      <div className="dm-loader__grid">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="dm-loader__cell" style={{ animationDelay: `${Math.random() * 3}s` }} />
        ))}
      </div>
      <div className="dm-loader__tokens">
        {['const', 'function', 'import', 'export', 'async', 'await', 'return', 'class', 'interface', 'type'].map((t, i) => (
          <span key={i} className="dm-loader__token">{t}</span>
        ))}
      </div>
      <div className="dm-loader__card">
        <div className="dm-loader__logo-wrap">
          <span className="dm-loader__logo-icon">🚀</span>
          <div className="dm-loader__orbit"><div className="dm-loader__orbit-dot" /></div>
          <div className="dm-loader__orbit dm-loader__orbit--2"><div className="dm-loader__orbit-dot--2" /></div>
        </div>
        <div className="dm-loader__brand">
          <span className="dm-loader__brand-dev">Dev</span>
          <span className="dm-loader__brand-market">Market</span>
        </div>
        <p className="dm-loader__tagline">IT Marketplace Hub</p>
        <div className="dm-loader__bar-track">
          <div className="dm-loader__bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="dm-loader__steps">
          {steps.map((step, i) => (
            <div key={i} className={`dm-loader__step ${i < activeStep ? 'dm-loader__step--done' : i === activeStep ? 'dm-loader__step--active' : ''}`}>
              <span className="dm-loader__step-icon">{i < activeStep ? '✓' : step.icon}</span>
              <span className="dm-loader__step-label">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="dm-loader__dots">
          {dots.map((on, i) => <div key={i} className={`dm-loader__dot ${on ? 'dm-loader__dot--on' : ''}`} />)}
        </div>
      </div>
    </div>
  );
}