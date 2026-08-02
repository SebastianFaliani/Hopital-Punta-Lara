import type { ReactNode } from 'react';

import PageTitle from '../PageTitle';
import TransfersNav from './TransfersNav';

type TransfersHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function TransfersHeader({
  title,
  description,
  actions
}: TransfersHeaderProps) {
  return (
    <>
      <div className="page-header">
        <div>
          <PageTitle icon="traslados">
            {title}
          </PageTitle>
          {description && (
            <p className="page-subtitle">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>

      <TransfersNav />
    </>
  );
}
