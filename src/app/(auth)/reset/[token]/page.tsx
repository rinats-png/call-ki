import { SetPasswordPage } from "@/components/SetPasswordPage";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <SetPasswordPage token={(await params).token} type="PASSWORD_RESET" />;
}
