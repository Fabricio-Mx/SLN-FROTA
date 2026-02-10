import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default async function HomePage() {
  const cookieStore = await cookies()
  const userCookie = cookieStore.get("app_user")

  if (userCookie?.value) {
    redirect("/dashboard")
  } else {
    redirect("/auth/login")
  }
}
