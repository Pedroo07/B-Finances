import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PeriodProps = {
  selectedMonth: number;
  onMonthChange: (month: number) => void;
};

const Period: React.FC<PeriodProps> = ({ onMonthChange, selectedMonth }) => {
  return (
    <li className="shrink-0">
      <Select
        name="Escolher mês"
        value={String(selectedMonth)}
        onValueChange={(value) => onMonthChange(Number(value))}
      >
        <SelectTrigger className="surface-chip h-9 min-w-34 rounded-full px-3.5 py-2 text-xs sm:h-10 sm:min-w-40 sm:px-4 sm:text-sm">
          <SelectValue placeholder="Escolher mês" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {new Date(0, i).toLocaleString("pt-BR", { month: "long" })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
};

export default Period;
