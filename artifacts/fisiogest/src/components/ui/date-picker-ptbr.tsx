import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerPTBRProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePickerPTBR({
  value,
  onChange,
  className,
  placeholder = "Selecione uma data",
  disabled,
}: DatePickerPTBRProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const isValidDate = parsed && isValid(parsed);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !isValidDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          {isValidDate
            ? format(parsed!, "dd/MM/yyyy", { locale: ptBR })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? parsed : undefined}
          onSelect={(day) => {
            onChange(day ? format(day, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          defaultMonth={isValidDate ? parsed : new Date()}
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

interface TimeInputPTBRProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  required?: boolean;
}

export function TimeInputPTBR({ value, onChange, className, required }: TimeInputPTBRProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^0-9:]/g, "");
    if (v.length === 2 && !v.includes(":") && e.nativeEvent instanceof InputEvent && e.nativeEvent.inputType !== "deleteContentBackward") {
      v = v + ":";
    }
    if (v.length > 5) v = v.slice(0, 5);
    onChange(v);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder="HH:mm"
      maxLength={5}
      required={required}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
    />
  );
}
