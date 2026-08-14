"use client"

import dynamic from "next/dynamic"
import { DashboardEntryGate } from "@/components/dashboard/dashboard-entry-gate"
import type { AppUser } from "@/lib/types"
import type { DashboardSection } from "@/components/dashboard/fleet-dashboard-client"

const FleetDashboardClient = dynamic(
  () => import("@/components/dashboard/fleet-dashboard-client").then((module) => module.FleetDashboardClient),
  {
    ssr: false,
    loading: () => null,
  }
)

type DashboardClientShellProps = {
  initialUser: AppUser
  initialSection?: DashboardSection
}

export function DashboardClientShell({ initialUser, initialSection }: DashboardClientShellProps) {
  return (
    <DashboardEntryGate>
      <FleetDashboardClient initialUser={initialUser} initialSection={initialSection} />
    </DashboardEntryGate>
  )
}