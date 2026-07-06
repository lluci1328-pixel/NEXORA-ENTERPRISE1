import "server-only";
import { redirect } from "next/navigation";
import { AuthError, requireBusinessAccess } from "./auth";
import type { Role } from "./constants";

/**
 * Resolves the tenant context for a business-scoped page. The layout already
 * enforced access, but each page re-resolves to get a typed { user, business,
 * role } and to keep pages independently safe. Redirects on any auth failure.
 */
export async function resolvePageContext(slug: string, minRole: Role = "SUPPORT") {
  try {
    return await requireBusinessAccess(slug, minRole);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.status === 401 ? "/login" : `/${slug}`);
    }
    throw error;
  }
}
