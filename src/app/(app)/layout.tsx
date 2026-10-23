import { SessionProvider } from "@/components/session";
import { Sidebar } from "@/components/Sidebar";
import { TenantBanner } from "@/components/TenantBanner";
import { LegalFooter } from "@/components/LegalFooter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col">
        <Sidebar />
        <main className="mx-auto w-full min-w-0 max-w-[1580px] flex-1 px-4 pb-12 pt-6 md:px-8 md:pt-8 lg:px-10">
          <TenantBanner />
          {children}
        </main>
        <LegalFooter />
      </div>
    </SessionProvider>
  );
}
