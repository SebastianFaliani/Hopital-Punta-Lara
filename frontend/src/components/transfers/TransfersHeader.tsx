import PageTitle from '../PageTitle';
import TransfersNav from './TransfersNav';

type TransfersHeaderProps = {
  title: string;
  description?: string;
};

export default function TransfersHeader({
  title,
  description
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
      </div>

      <TransfersNav />
    </>
  );
}
