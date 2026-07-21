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
  | 'whatsapp'
  | 'message-check'
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
  whatsapp: 'M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4A8 8 0 1 1 20 11.5ZM8.5 8.5c.2 3.8 3.2 6.6 6.9 7 .7.1 1.5-.9 1.6-1.4l-2.1-1c-.4.5-.7.8-1.2.7-1.4-.3-3.1-1.9-3.4-3.3-.1-.5.3-.8.7-1.2l-1-2.1c-.7.1-1.6.6-1.5 1.3Z',
  'message-check': 'M3 12.5 7 16.5 15 6.5M10 12.5 14 16.5 22 6.5',
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
