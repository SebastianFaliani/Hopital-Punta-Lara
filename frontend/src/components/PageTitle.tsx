import type { ReactNode } from 'react';

type PageTitleProps = {
  children: ReactNode;
  icon: string;
};

export default function PageTitle({
  children,
  icon
}: PageTitleProps) {
  return (
    <h1 className="page-title page-title-with-icon">
      <img
        src={`/menu-icons/${icon}.png`}
        alt=""
        className="page-title-icon"
        aria-hidden="true"
      />
      <span>
        {children}
      </span>
    </h1>
  );
}
