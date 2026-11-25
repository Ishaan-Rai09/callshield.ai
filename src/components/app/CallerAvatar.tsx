import { Phone } from "lucide-react";
import { initials } from "@/lib/format";
import { cx } from "@/lib/utils";

export function CallerAvatar({
  name,
  size = "md",
  className,
}: {
  name: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const avatarInitials = initials(name ?? "");

  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full border border-line bg-ash font-display font-semibold text-ink/70",
        size === "sm" && "h-8 w-8 text-[10px]",
        size === "md" && "h-9 w-9 text-[11px]",
        size === "lg" && "h-12 w-12 text-[13px]",
        className,
      )}
    >
      {avatarInitials || (
        <Phone className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={1.7} />
      )}
    </span>
  );
}
