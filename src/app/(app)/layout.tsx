import { SessionProvider } from "@/components/session";
import { AppShell } from "@/components/Sidebar";
import { TenantBanner } from "@/components/TenantBanner";
import { LegalFooter } from "@/components/LegalFooter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell footer={<LegalFooter />}>
        <TenantBanner />
        {children}
      </AppShell>
    </SessionProvider>
  );
}
