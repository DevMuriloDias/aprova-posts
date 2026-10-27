import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-orange-500 text-sm text-white"
      >
        ✓
      </span>
      Aprova Posts
    </Link>
  );
}
