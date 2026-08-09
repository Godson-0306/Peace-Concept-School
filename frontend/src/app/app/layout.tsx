import AuthGuard from "@/components/AuthGuard";
import AppMobileNav from "@/components/AppMobileNav";
import AppSidebar from "@/components/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[var(--mist)]">
        <div className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-0 h-screen">
            <AppSidebar />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <AppMobileNav />
          <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
