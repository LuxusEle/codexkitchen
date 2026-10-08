import React from 'react';
import {Box} from 'lucide-react';

export default function StudioBrand({subtitle='DESIGN STUDIO'}) {
  return <div className="brand studio-brand"><span className="brand-icon"><Box size={24} strokeWidth={1.6}/></span><span>codex<span className="brand-light">kitchen</span><small>{subtitle}</small></span></div>;
}
