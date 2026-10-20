import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TOOLS } from "@/lib/tools";
export default function Page() {
  return (
    <main className="page">
      <h1>Internal tools</h1>
      <div className="tool-grid">
        {TOOLS.map(({ href, name, description, icon: Icon }) => (
          <Link key={href} href={href} className="tool-card">
            <Icon size={20} aria-hidden />
            <strong>
              {name} <ChevronRight size={16} aria-hidden />
            </strong>
            <span className="muted">{description}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
