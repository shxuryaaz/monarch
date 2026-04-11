import { cn } from "@/lib/utils";

/** Served from `public/logo.png` */
export const LOGO_SRC = "/logo.png";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";

const sizeClass: Record<BrandMarkSize, string> = {
  xs: "h-5 w-5 min-h-[1.25rem] min-w-[1.25rem]",
  sm: "h-7 w-7 min-h-7 min-w-7",
  md: "h-9 w-9 min-h-9 min-w-9",
  lg: "h-10 w-10 min-h-10 min-w-10",
  xl: "h-12 w-12 min-h-12 min-w-12",
  hero: "h-[4.25rem] w-[4.25rem] min-h-[4.25rem] min-w-[4.25rem] sm:h-24 sm:w-24 sm:min-h-24 sm:min-w-24 md:h-[7rem] md:w-[7rem] md:min-h-[7rem] md:min-w-[7rem]"
};

type Props = {
  size?: BrandMarkSize;
  /** Use `alt=""` when a visible or sr-only heading duplicates the name (e.g. hero). */
  alt?: string;
  className?: string;
};

/** Monarch wordmark (`public/logo.png`) — white mark on dark tile; reads on light + dark UI without CSS invert. */
export function BrandMark({ size = "md", alt = "Monarch", className }: Props) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      width={512}
      height={512}
      className={cn("object-contain object-center", sizeClass[size], className)}
      decoding="async"
    />
  );
}
