export default function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-4 my-8 rounded-[10px] border border-border bg-surface p-6 text-center">
      <p className="font-serif text-lg font-bold text-ink">{title}</p>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
