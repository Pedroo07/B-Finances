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
  }

  return categoryMap[category] ?? category
}
