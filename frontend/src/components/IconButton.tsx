type IconButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger';

type IconButtonIcon =
  | 'check'
  | 'close'
  | 'edit'
  | 'print'
  | 'trash'
  | 'eye'
  | 'plus'
  | 'download'
  | 'message'
  | 'lock'
  | 'unlock';

type IconButtonProps = {
  icon: IconButtonIcon;
  label: string;
  type?: 'button' | 'submit';
  variant?: IconButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

const iconPaths: Record<IconButtonIcon, string> = {
  check: 'M20 6 9 17l-5-5',
  close: 'M18 6 6 18M6 6l12 12',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6Z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16M10 11v6M14 11v6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  message: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M6 11h12v10H6Z',
  unlock: 'M7 11V7a5 5 0 0 1 9.5-2.2M6 11h12v10H6Z'
};

export function IconButton({
  icon,
  label,
  type = 'button',
  variant = 'secondary',
  disabled = false,
  onClick,
  className = ''
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button icon-button-${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type={type}
    >
      <svg
        aria-hidden="true"
        className="icon-button-svg"
        fill="none"
        focusable="false"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d={iconPaths[icon]} />
      </svg>
    </button>
  );
}

export function IconLink({
  icon,
  label,
  to,
  variant = 'secondary',
  className = ''
}: {
  icon: IconButtonIcon;
  label: string;
  to: string;
  variant?: IconButtonVariant;
  className?: string;
}) {
  return (
    <Link
      aria-label={label}
      className={`icon-button icon-button-${variant} ${className}`.trim()}
      title={label}
      to={to}
    >
      <svg
        aria-hidden="true"
        className="icon-button-svg"
        fill="none"
        focusable="false"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d={iconPaths[icon]} />
      </svg>
    </Link>
  );
}
import { Link } from 'react-router-dom';
