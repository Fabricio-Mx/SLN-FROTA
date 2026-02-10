import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  
  // Credenciais do usuário de teste admin
  const testEmail = "admin@sln.com"
  const testPassword = "admin123"
  
  try {
    // Tentar fazer signUp com o usuário de teste
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          nome: "Administrador",
          is_admin: true
        }
      }
    })

    if (authError) {
      // Se o usuário já existe, retorna sucesso com as credenciais
      if (authError.message.includes("already") || authError.message.includes("exists") || authError.message.includes("registered")) {
        return NextResponse.json({ 
          success: true, 
          message: "Usuário de teste já existe. Use as credenciais abaixo para fazer login.",
          credentials: { email: testEmail, password: testPassword }
        })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar perfil do usuário se o auth foi bem sucedido
    if (authData.user) {
      await supabase.from("profiles").upsert({
        id: authData.user.id,
        email: testEmail,
        nome: "Administrador",
        is_admin: true
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: "Usuário de teste criado com sucesso! Verifique se precisa confirmar o email.",
      credentials: { email: testEmail, password: testPassword },
      note: "Se o Supabase estiver configurado para confirmar email, você precisará desativar essa opção ou confirmar manualmente."
    })
  } catch (error) {
    console.error("Erro:", error)
    return NextResponse.json({ error: "Erro ao criar usuário de teste" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST para criar o usuário de teste",
    credentials: {
      email: "admin@sln.com",
      password: "admin123"
    }
  })
}
