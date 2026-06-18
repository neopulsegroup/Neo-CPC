import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

type CompanySectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function CompanySectionHeader({
  icon: Icon,
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
  className = 'mb-6',
}: CompanySectionHeaderProps) {
  return (
    <div className={className}>
      {backHref && backLabel ? (
        <Link to={backHref} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="h-7 w-7 shrink-0 text-primary" />
            <span>{title}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}
