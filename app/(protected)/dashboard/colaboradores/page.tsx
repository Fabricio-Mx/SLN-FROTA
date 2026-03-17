import { DashboardClientShell } from "@/app/(protected)/dashboard/page-client-shell"
import { getDashboardInitialUser } from "@/app/(protected)/dashboard/get-initial-user"

export default async function CollaboratorsPage() {
  const initialUser = await getDashboardInitialUser()

  return <DashboardClientShell initialUser={initialUser} initialSection="colaboradores" />
}