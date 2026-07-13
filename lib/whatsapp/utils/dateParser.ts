import { resolveFinancialPeriod } from "../financial/periodResolver";
import { getBrasiliaDate } from "./brasiliaDate";

export function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const resolved = resolveFinancialPeriod({
    messageText: period,
    currentDate: getBrasiliaDate(),
  });

  return {
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  };
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function getMonthName(monthNumber: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return months[monthNumber - 1] || "";
}
