type Size = "sm" | "md" | "lg";

const heightClass: Record<Size, string> = {
  /** Mobile / compact bars */
  sm: "h-16 sm:h-20",
  /** Top app bars */
  md: "h-24 sm:h-28",
  /** Onboarding sidebar hero */
  lg: "h-40 xl:h-44",
};

type Props = {
  size?: Size;
  className?: string;
};

/** Full wordmark from `public/logo.png` (designed for a black background). */
export function CampaignLogo({ size = "md", className = "" }: Props) {
  return (
    <img
      src="/logo.png"
      alt="CampaignOS — powered by NIA and Reacher"
      className={`${heightClass[size]} w-auto max-w-full object-contain object-left ${className}`.trim()}
    />
  );
}
