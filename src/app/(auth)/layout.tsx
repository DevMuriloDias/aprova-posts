import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function LayoutAuth({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
