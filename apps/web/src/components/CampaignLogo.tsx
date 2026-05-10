type Size = "xs" | "sm" | "md" | "lg";

const iconHeightClass: Record<Size, string> = {
  /** Sidebar strip / very tight headers */
  xs: "h-8",
  /** Mobile / compact bars */
  sm: "h-16 sm:h-20",
  /** Top app bars */
  md: "h-24 sm:h-28",
  /** Larger placements (non-onboarding) */
  lg: "h-40 xl:h-44",
};

/** Horizontal wordmark from `public/logo.png`. */
const wordmarkHeightClass: Record<Size, string> = {
  xs: "h-7 sm:h-8",
  sm: "h-16 sm:h-20",
  md: "h-16 sm:h-20",
  lg: "h-24 xl:h-28",
};

type Props = {
  size?: Size;
  /** Use full CampaignOS wordmark (onboarding only); default is the square icon. */
  variant?: "icon" | "wordmark";
  className?: string;
};

export function CampaignLogo({ size = "md", variant = "icon", className = "" }: Props) {
  const isWordmark = variant === "wordmark";
  const src = isWordmark ? "/logo.png" : "/logo_icon.png";
  const heights = isWordmark ? wordmarkHeightClass : iconHeightClass;

  return (
    <img
      src={src}
      alt="CampaignOS — powered by NIA and Reacher"
      className={`${heights[size]} w-auto max-w-full object-contain object-left ${className}`.trim()}
    />
  );
}
