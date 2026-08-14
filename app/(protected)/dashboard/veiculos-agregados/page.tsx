import { getDashboardInitialUser } from "@/app/(protected)/dashboard/get-initial-user"
import { redirect } from "next/navigation"

export default async function AggregatedVehiclesPage() {
  await getDashboardInitialUser()

  redirect("/dashboard/veiculos-frota")
}