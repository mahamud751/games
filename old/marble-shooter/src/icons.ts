export function iconSound(on: boolean): string {
  const waves = on
    ? `<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15 9.2a3.6 3.6 0 0 1 0 5.6M17.4 6.8a7 7 0 0 1 0 10.4"/>`
    : `<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M15.2 9.2l4.6 5.6M19.8 9.2l-4.6 5.6"/>`
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.2 9.4v5.2h3.1L11 18.4V5.6L6.3 9.4H3.2z"/>${waves}</svg>`
}

export function iconPause(): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.5 4.5h3.4v15H6.5zM14.1 4.5h3.4v15h-3.4z"/></svg>`
}
