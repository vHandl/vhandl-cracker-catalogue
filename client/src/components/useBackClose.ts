import { useEffect, useRef } from 'react';

// Number of history.back() calls we triggered ourselves; their popstate events must not close anything.
let selfBacks = 0;

/**
 * Makes the phone's Back button (Android) / back swipe (iOS) close an open pop-up
 * instead of leaving the catalogue page.
 */
export function useBackClose(active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    window.history.pushState({ ...(window.history.state ?? {}), modal: true }, '');
    let closedByBack = false;

    const onPop = () => {
      if (selfBacks > 0) {
        selfBacks--;
        return;
      }
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (!closedByBack && window.history.state?.modal) {
        selfBacks++;
        window.history.back();
      }
    };
  }, [active]);
}
