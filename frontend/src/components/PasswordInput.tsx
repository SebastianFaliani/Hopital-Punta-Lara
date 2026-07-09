import {
  useState
} from 'react';

type PasswordInputProps = {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  name?: string;
  className?: string;
  autoComplete?: string;
};

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  name,
  className = 'form-input',
  autoComplete
}: PasswordInputProps) {

  const [visible, setVisible] =
    useState(false);

  return (
    <div className="password-input-wrap">
      <input
        autoComplete={autoComplete}
        className={`${className} password-input-field`}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        value={value}
      />

      <button
        aria-label={
          visible
            ? 'Ocultar contrasena'
            : 'Mostrar contrasena'
        }
        className="password-toggle-button"
        onClick={() =>
          setVisible((current) => !current)
        }
        title={
          visible
            ? 'Ocultar contrasena'
            : 'Mostrar contrasena'
        }
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          focusable="false"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
      </button>
    </div>
  );
}
