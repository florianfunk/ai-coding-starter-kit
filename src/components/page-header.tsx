import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function PageHeader({
  title, subtitle, children, eyebrow, breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  eyebrow?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="mb-6 space-y-3 pb-5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="eyebrow mb-1 text-primary">{eyebrow}</p>
          )}
          <h1 className="display-lg text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
      </div>
    </div>
  );
}
