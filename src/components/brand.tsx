import Link from "next/link";

// "86" = struck off the menu — the strikethrough IS the brand.
export function Brand({
  className = "text-xl",
  animate = false,
  asLink = true,
}: {
  className?: string;
  animate?: boolean;
  asLink?: boolean;
}) {
  const mark = (
    <span className={`font-serif font-semibold tracking-tight ${className}`}>
      Eighty
      <span className={animate ? "strike-brass" : "relative"}>
        {!animate && (
          <span className="absolute -left-[2%] -right-[2%] top-[54%] h-[0.06em] min-h-[1.5px] bg-brass" />
        )}
        Six
      </span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" className="transition-opacity hover:opacity-80">
      {mark}
    </Link>
  );
}
