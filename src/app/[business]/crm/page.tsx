import { redirect } from "next/navigation";

export default async function CrmIndex({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await params;
  redirect(`/${business}/crm/leads`);
}
