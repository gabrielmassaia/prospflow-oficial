import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

// useSyncExternalStore é o jeito idiomático de assinar um estado externo do browser
// (aqui, o matchMedia) — sem effect + setState síncrono. O snapshot do servidor devolve
// `false` para não haver mismatch de hidratação; o cliente lê a largura real.
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  );
}
