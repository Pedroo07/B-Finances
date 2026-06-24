import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function translateCategory(category: string) {
  const categoryMap: Record<string, string> = {
    salary: "Salário",
    extra: "Extra",
    other: "Outros",
    fixes: "Fixas",
    foods: "Alimentação",
    entertainment: "Lazer",
    cdb: "CDB",
    imoveis: "Imóveis",
    cripto: "Cripto",
    acoes: "Ações",
    fundos: "Fundos",
  }

  return categoryMap[category] ?? category
}

export function translatePaymentMethod(method: string) {
  const methodMap: Record<string, string> = {
    cash: "Dinheiro",
    pix: "Pix",
    debit: "Cartão de Débito",
    credit_card: "Cartão de Crédito",
  }

  return methodMap[method] ?? method
}

