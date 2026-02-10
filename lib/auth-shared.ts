import type { UserRole, AppUser } from "@/lib/types"

// Credenciais do login mestre (hardcoded)
export const MASTER_CREDENTIALS = {
  email: "admin",
  password: "admin1234",
}

// Verifica se as credenciais sao do login mestre
export function isMasterLogin(email: string, password: string): boolean {
  return email === MASTER_CREDENTIALS.email && password === MASTER_CREDENTIALS.password
}

// Retorna o usuario mestre
export function getMasterUser(): AppUser {
  return {
    id: "master",
    email: "admin",
    nome: "Administrador Mestre",
    role: "mestre",
    isMaster: true,
  }
}

// Labels para os roles
export const ROLE_LABELS: Record<UserRole, string> = {
  mestre: "Mestre",
  consulta: "Consulta",
  administrativo: "Administrativo",
  logistico: "Logístico",
}

// Descricoes dos roles
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  mestre: "Acesso total ao sistema. Pode cadastrar e gerenciar usuários.",
  consulta: "Visualização total do sistema. Não pode adicionar, editar ou excluir dados.",
  administrativo: "Funções administrativas (a serem definidas).",
  logistico: "Funções logísticas (a serem definidas).",
}

// Permissoes por role
export function canCreateUsers(role: UserRole): boolean {
  return role === "mestre"
}

export function canEditData(role: UserRole): boolean {
  return role !== "consulta"
}

export function canDeleteData(role: UserRole): boolean {
  return role !== "consulta"
}

export function canAddVehicles(role: UserRole): boolean {
  return role !== "consulta"
}

export function canAddColaboradores(role: UserRole): boolean {
  return role !== "consulta"
}
