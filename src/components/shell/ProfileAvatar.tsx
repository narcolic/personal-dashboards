import type { User } from "@supabase/supabase-js";
import { avatarUrl } from "@/lib/profile";

export function ProfileAvatar({
  user,
  className = "size-7",
}: {
  user: User | null | undefined;
  className?: string;
}) {
  const src = avatarUrl(user);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 text-primary ${className}`}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="size-[60%]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.5-3.5 3-5.5 7-5.5s6.5 2 7 5.5" />
        </svg>
      )}
    </span>
  );
}
