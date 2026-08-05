import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center gap-1.5 text-xs text-neutral-500 mb-4 overflow-x-auto py-1 ${className}`} aria-label="Breadcrumb">
      <Link
        to="/today"
        className="flex items-center gap-1 hover:text-neutral-900 transition-colors font-medium whitespace-nowrap text-neutral-500"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-1.5 whitespace-nowrap">
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="hover:text-neutral-900 transition-colors font-medium text-neutral-500"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`font-semibold ${isLast ? 'text-neutral-900' : 'text-neutral-500'}`}>
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
