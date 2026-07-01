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

export function standardizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) {
    digits = '55' + digits;
  }
  return '+' + digits;
}

export function getPhoneVariations(phone: string): string[] {
  let digits = phone.replace(/\D/g, '');
  
  if (digits.length >= 12 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  
  if (digits.length !== 10 && digits.length !== 11) {
    return ['+55' + digits];
  }
  
  const ddd = digits.slice(0, 2);
  const localNumber = digits.slice(2);
  
  let version10 = '';
  let version11 = '';
  
  if (digits.length === 11) {
    version11 = digits;
    if (localNumber.startsWith('9')) {
      version10 = ddd + localNumber.slice(1);
    } else {
      version10 = digits;
    }
  } else {
    version10 = digits;
    version11 = ddd + '9' + localNumber;
  }
  
  return ['+55' + version10, '+55' + version11];
}
