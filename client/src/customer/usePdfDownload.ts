import { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfResult } from '../pdf';
import type { Order, Shop } from '../types';

type PdfLib = typeof import('../pdf');

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Loads the PDF library, retrying a couple of times because phone connections drop. */
async function importPdfLib(): Promise<PdfLib> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await import('../pdf');
    } catch (e) {
      lastError = e;
      await wait(500 * (attempt + 1));
    }
  }
  throw lastError;
}

let sharedLib: Promise<PdfLib> | null = null;
function loadLib(): Promise<PdfLib> {
  if (!sharedLib) {
    sharedLib = importPdfLib().catch((e) => {
      sharedLib = null; // allow another try next time
      throw e;
    });
  }
  return sharedLib;
}

export type PdfStatus = 'idle' | 'working' | 'error';

/**
 * Builds an order's PDF only when asked (showing a loader meanwhile) and saves it.
 * The PDF library is fetched in the background so the first tap is usually quick.
 */
export function usePdfDownload(shop: Shop, order: Order) {
  const [status, setStatus] = useState<PdfStatus>('idle');
  const [errorText, setErrorText] = useState('');
  const built = useRef<PdfResult | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    loadLib().catch(() => {});
  }, []);

  const download = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus('working');
    setErrorText('');
    try {
      const lib = await loadLib();
      if (!built.current) {
        await wait(60); // let the loader paint before the (blocking) PDF build starts
        built.current = lib.buildOrderPdf(shop, order);
      }
      lib.downloadPdf(built.current);
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setErrorText(e instanceof Error ? e.message : String(e));
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }, [shop, order]);

  return { status, errorText, download };
}
