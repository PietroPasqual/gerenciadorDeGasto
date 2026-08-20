import '@testing-library/jest-dom/vitest'

/** jsdom não implementa ResizeObserver, exigido pelo ResponsiveContainer do Recharts. */
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverMock as never)

/** matchMedia é usado pelo NumeroAnimado (prefers-reduced-motion) e pelo hook de mobile. */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as never
}
