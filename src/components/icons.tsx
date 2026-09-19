export function YesIcon({ label }: { label: string }) {
  return (
    <span className="icon-yes" title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.8 12.2 10.4 15.8 17.2 8.6" />
      </svg>
    </span>
  );
}

export function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.2 12a7.8 7.8 0 1 0 2.3-5.5" />
      <path d="M4 4.8V9h4.2" />
      <path d="M12 8.2V12l2.7 1.7" />
    </svg>
  );
}
