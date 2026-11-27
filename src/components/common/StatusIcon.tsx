import type { BotStatus } from '../../types/bot';

const LABELS: Record<BotStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  done: 'Done',
  error: 'Error',
};

interface StatusIconProps {
  status: BotStatus;
  size?: number;
  /** Set when a visible label already names the status. */
  decorative?: boolean;
}

/**
 * One drawn glyph per status, so status never relies on colour alone:
 * running = rotating arc, waiting = ring + pulsing core, idle = dashed ring,
 * done = filled check, error = filled cross.
 */
export function StatusIcon({ status, size = 14, decorative = false }: StatusIconProps) {
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': LABELS[status] };

  return (
    <svg
      className={`status-icon status-icon--${status}`}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      {...a11y}
    >
      {status === 'running' && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
          <path
            className="status-icon__arc"
            d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
      {status === 'waiting' && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
          <circle className="status-icon__pulse" cx="7" cy="7" r="2.2" fill="currentColor" />
        </>
      )}
      {status === 'idle' && (
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2" />
      )}
      {status === 'done' && (
        <>
          <circle cx="7" cy="7" r="6.2" fill="currentColor" />
          <path className="status-icon__check" d="m4.4 7.2 1.8 1.8 3.6-3.8" />
        </>
      )}
      {status === 'error' && (
        <>
          <circle cx="7" cy="7" r="6.2" fill="currentColor" />
          <path className="status-icon__cross" d="m4.8 4.8 4.4 4.4M9.2 4.8 4.8 9.2" />
        </>
      )}
    </svg>
  );
}

export const STATUS_LABELS = LABELS;
