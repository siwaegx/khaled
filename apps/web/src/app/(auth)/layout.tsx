import Link from "next/link";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-hero-pattern bg-grid relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/8 blur-3xl" />

      <Link href="/" className="relative flex items-center gap-2.5 font-bold text-lg mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
          <Zap className="w-4.5 h-4.5 text-white" />
        </div>
        <span>Business<span className="text-gradient">360</span></span>
      </Link>

      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
