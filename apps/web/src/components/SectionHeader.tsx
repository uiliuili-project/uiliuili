import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function SectionHeader({
  title,
  description,
  href,
}: {
  title: string;
  description?: string;
  href?: string;
}) {
  return (
    <div className="section-title mb-4">
      <div>
        <span>{title}</span>
        {description && <p className="mt-0.5 text-sm font-normal text-muted">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-normal text-muted hover:text-brand"
        >
          查看全部
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
