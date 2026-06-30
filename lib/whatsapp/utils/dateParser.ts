export function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  switch (period.toLowerCase()) {
    case "today":
    case "hoje":
      return {
        startDate: today.toISOString().split("T")[0],
        endDate: today.toISOString().split("T")[0],
      };

    case "week":
    case "semana":
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        startDate: weekStart.toISOString().split("T")[0],
        endDate: weekEnd.toISOString().split("T")[0],
      };

    case "month":
    case "mês":
    case "mes":
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      return {
        startDate: monthStart.toISOString().split("T")[0],
        endDate: monthEnd.toISOString().split("T")[0],
      };

    case "year":
    case "ano":
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      return {
        startDate: yearStart.toISOString().split("T")[0],
        endDate: yearEnd.toISOString().split("T")[0],
      };

    case "last_month":
    case "mês passado":
    case "mes passado":
      const lastMonthStart = new Date(year, month - 1, 1);
      const lastMonthEnd = new Date(year, month, 0);
      return {
        startDate: lastMonthStart.toISOString().split("T")[0],
        endDate: lastMonthEnd.toISOString().split("T")[0],
      };

    default:
      return {
        startDate: new Date(year, month, 1).toISOString().split("T")[0],
        endDate: new Date(year, month + 1, 0).toISOString().split("T")[0],
      };
  }
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
