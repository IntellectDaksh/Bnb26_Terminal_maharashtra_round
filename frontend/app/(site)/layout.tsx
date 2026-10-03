import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper flex min-h-full flex-1 flex-col">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
