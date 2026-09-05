import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VectorMark from './skydex/mark/VectorMark';
import { Wordmark } from './skydex/ui/Wordmark';

function SkydexBrand() {
  const [paused, setPaused] = useState(document.body.dataset.paused === 'true');
  useEffect(() => {
    const update = (event: Event) => setPaused((event as CustomEvent).detail.paused);
    document.addEventListener('portfolio:motion', update);
    return () => document.removeEventListener('portfolio:motion', update);
  }, []);
  return <span className="skydex-brand">
    <VectorMark alert={false} thinking={false} ambient paused={paused} className="wonder-prefix" />
    <Wordmark size={23} className="skydex-wordmark" />
  </span>;
}
const mount = document.getElementById('skydex-brand-root');
if (mount) createRoot(mount).render(<SkydexBrand />);
