import { SessionProvider } from "@/components/session";
import { AppShell } from "@/components/Sidebar";
import { TenantBanner } from "@/components/TenantBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { LegalFooter } from "@/components/LegalFooter";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppShell footer={<LegalFooter />}>
        <TenantBanner />
        <TrialBanner />
        {children}
      </AppShell>
    </SessionProvider>
  );
}
