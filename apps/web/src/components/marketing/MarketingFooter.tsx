import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Modules", href: "/#modules" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Free Trial", href: "/register" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Privacy", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-4">
              <div className="w-7 h-7 rounded-lg bg-gradient-brand flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span>Business<span className="text-gradient">360</span></span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px]">
              The modular ERP SaaS platform for growing businesses.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <p className="font-semibold text-sm mb-4">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Business360. All rights reserved.</span>
          <span className="text-xs">Built with Next.js · TypeScript · Prisma</span>
        </div>
      </div>
    </footer>
  );
}
