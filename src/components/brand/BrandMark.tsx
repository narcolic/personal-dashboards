type BrandMarkProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
    >
      {decorative ? null : <title>Terminal Hub</title>}
      <path
        d="M24 10H10v14M40 10h14v14M54 40v14H40M24 54H10V40"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect x="27" y="27" width="10" height="10" rx="1" className="fill-primary" />
    </svg>
  );
}
