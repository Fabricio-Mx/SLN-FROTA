"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-[#7CB342] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Erro de Autenticação</h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro durante a autenticação
          </p>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login">
            <Button className="bg-[#7CB342] hover:bg-[#689F38] text-white">
              Voltar para o Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
