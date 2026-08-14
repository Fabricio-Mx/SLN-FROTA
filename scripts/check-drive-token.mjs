import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const envPath = path.join(process.cwd(), ".env.local")
const envText = fs.readFileSync(envPath, "utf8")

for (const line of envText.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue
  const separatorIndex = line.indexOf("=")
  if (separatorIndex === -1) continue

  const key = line.slice(0, separatorIndex).trim()
  const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "")
  process.env[key] = value
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env ausente.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const { data, error } = await supabase
  .from("drive_tokens")
  .select("id, refresh_token, updated_at")
  .eq("id", "default")
  .maybeSingle()

if (error) {
  throw error
}

console.log(
  JSON.stringify({
    exists: Boolean(data?.refresh_token),
    updatedAt: data?.updated_at ?? null,
  })
)