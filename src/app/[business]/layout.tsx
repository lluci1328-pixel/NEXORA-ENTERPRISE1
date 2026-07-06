import { redirect } from "next/navigation";
import { AuthError, requireBusinessAccess, getAccessibleBusinesses } from "@/lib/auth";
import { getUnreadNotifications } from "@/lib/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ROLE_LABELS, type Role } from "@/lib/constants";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ business: string }>;
}) {
  const { business: slug } = await params;

  let ctx;
  try {
    ctx = await requireBusinessAccess(slug);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.status === 401) redirect("/login");
      redirect("/");
    }
    throw error;
  }
  const { user, business, role } = ctx;

  const [businesses, notifications] = await Promise.all([
    getAccessibleBusinesses(),
    getUnreadNotifications(business.id),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        slug={business.slug}
        businessName={business.name}
        industry={business.industry}
        role={ROLE_LABELS[role as Role]}
        businesses={businesses.map((b) => ({ slug: b.slug, name: b.name, industry: b.industry }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          slug={business.slug}
          userName={user.name}
          userTitle={user.title ?? ROLE_LABELS[role as Role]}
          notifications={notifications.items}
          unreadCount={notifications.count}
        />
        <main className="flex-1 overflow-y-auto scrollbar-slim px-6 py-6">
          <div className="mx-auto max-w-7xl rise-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
