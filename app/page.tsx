import { redirect } from "next/navigation"
import { verifySession } from "@/lib/auth"

export default async function HomePage() {
  const session = await verifySession()

  if (session) {
    redirect("/dashboard")
  } else {
    redirect("/auth/login")
  }
}
