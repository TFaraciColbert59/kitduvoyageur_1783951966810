export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-[color:var(--label-secondary)] font-body">
      {children}
    </p>
  );
}
