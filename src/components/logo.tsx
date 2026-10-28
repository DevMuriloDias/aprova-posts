import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-tinta">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-[10px] bg-marca-600 text-base font-black text-destaque"
      >
        ✓
      </span>
      <span>
        Aprova<span className="text-marca-600">Posts</span>
      </span>
    </Link>
  );
}
