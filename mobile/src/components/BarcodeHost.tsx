

import React, { useEffect, useState } from 'react';

import { BarcodeScannerModal } from './BarcodeScannerModal';

type Opts = { accept?: 'numeric' | 'any'; onCode: (code: string) => void };

let handler: ((opts: Opts) => void) | null = null;

export function openBarcode(opts: Opts): void {
  if (handler) handler(opts);
}

export function BarcodeHost() {
  const [opts, setOpts] = useState<Opts | null>(null);

  useEffect(() => {
    handler = (next) => setOpts(next);
    return () => {
      handler = null;
    };
  }, []);

  if (!opts) return null;

  return (
    <BarcodeScannerModal
      visible
      accept={opts.accept ?? 'numeric'}
      onClose={() => setOpts(null)}
      onCode={(code) => {
        const run = opts.onCode;
        setOpts(null);
        run(code);
      }}
    />
  );
}

export default BarcodeHost;
