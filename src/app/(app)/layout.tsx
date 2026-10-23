import { SessionProvider } from "@/components/session";
import { Sidebar } from "@/components/Sidebar";
import { TenantBanner } from "@/components/TenantBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
          <TenantBanner />
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
