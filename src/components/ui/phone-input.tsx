import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

export const COUNTRY_CODES = [
  { code: 'PT', name: 'Portugal', dial_code: '+351', flag: '🇵🇹' },
  { code: 'BR', name: 'Brasil', dial_code: '+55', flag: '🇧🇷' },
  { code: 'AO', name: 'Angola', dial_code: '+244', flag: '🇦🇴' },
  { code: 'MZ', name: 'Moçambique', dial_code: '+258', flag: '🇲🇿' },
  { code: 'CV', name: 'Cabo Verde', dial_code: '+238', flag: '🇨🇻' },
  { code: 'GW', name: 'Guiné-Bissau', dial_code: '+245', flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé e Príncipe', dial_code: '+239', flag: '🇸🇹' },
  { code: 'TL', name: 'Timor-Leste', dial_code: '+670', flag: '🇹🇱' },
  { code: 'UA', name: 'Ucrânia', dial_code: '+380', flag: '🇺🇦' },
  { code: 'IN', name: 'Índia', dial_code: '+91', flag: '🇮🇳' },
  { code: 'FR', name: 'França', dial_code: '+33', flag: '🇫🇷' },
  { code: 'GB', name: 'Reino Unido', dial_code: '+44', flag: '🇬🇧' },
  { code: 'ES', name: 'Espanha', dial_code: '+34', flag: '🇪🇸' },
  { code: 'US', name: 'EUA', dial_code: '+1', flag: '🇺🇸' },
];

interface PhoneInputProps {
  id?: string;
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function formatPhoneNumber(countryCode: string, raw: string) {
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';

  if (countryCode === 'PT') {
    const trimmed = digits.slice(0, 9);
    if (trimmed.length <= 3) return trimmed;
    if (trimmed.length <= 6) return `${trimmed.slice(0, 3)} ${trimmed.slice(3)}`;
    return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
  }

  if (countryCode === 'BR') {
    const trimmed = digits.slice(0, 11);
    if (trimmed.length <= 2) return trimmed;
    const ddd = trimmed.slice(0, 2);
    const rest = trimmed.slice(2);
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  const trimmed = digits.slice(0, 15);
  const groups: string[] = [];
  for (let i = 0; i < trimmed.length; i += 3) groups.push(trimmed.slice(i, i + 3));
  return groups.join(' ');
}

export function formatPhoneValueForDisplay(value: string) {
  if (!value || !value.trim()) return '';
  const val = value.trim();
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.dial_code.length - a.dial_code.length);
  const country = sortedCodes.find((c) => val.startsWith(c.dial_code)) || COUNTRY_CODES[0];
  const rest = val.startsWith(country.dial_code) ? val.slice(country.dial_code.length).trim() : val;
  const formatted = formatPhoneNumber(country.code, rest);
  return `${country.dial_code}${formatted ? ` ${formatted}` : ''}`.trim();
}

/** Dígitos da parte nacional (após o indicativo detetado). */
export function nationalDigitsFromPhoneValue(value: string): string {
  const val = value.trim();
  if (!val) return '';
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial_code.length - a.dial_code.length);
  const country = sorted.find((c) => val.startsWith(c.dial_code)) || COUNTRY_CODES[0];
  const rest = val.startsWith(country.dial_code) ? val.slice(country.dial_code.length) : val;
  return rest.replace(/\D/g, '');
}

/** Valor a gravar: `null` se não houver número nacional; caso contrário string formatada. */
export function companyPhoneForPayload(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (nationalDigitsFromPhoneValue(t).length === 0) return null;
  return formatPhoneValueForDisplay(t).trim();
}

/** Vazio é válido; com texto, total de dígitos (indicativo + nacional) entre 8 e 15 (E.164). */
export function isValidInternationalPhone(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  const digits = t.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export function PhoneInput({ id, name, value = '', onChange, placeholder, className, disabled }: PhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  
  // Helper to find country from full phone string
  const findCountryFromValue = (val: string) => {
    if (!val) return COUNTRY_CODES[0]; // Default: Portugal
    // Try to match dial codes, sorted by length descending to match longest prefix first
    // (though our list is small, +1 vs +123 matters)
    const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.dial_code.length - a.dial_code.length);
    const country = sortedCodes.find(c => val.startsWith(c.dial_code));
    return country || COUNTRY_CODES[0];
  };

  const [selectedCountry, setSelectedCountry] = React.useState(() => findCountryFromValue(value));

  // Sync selected country if external value changes drastically (e.g. initial load)
  React.useEffect(() => {
    const derivedCountry = findCountryFromValue(value);
    // Only update if the current selected country doesn't match the value's prefix anymore
    // This prevents jitter while typing if user types something that temporarily doesn't match
    if (!value.startsWith(selectedCountry.dial_code)) {
       setSelectedCountry(derivedCountry);
    }
  }, [value, selectedCountry.dial_code]);

  const getPhoneNumber = () => {
    if (!value) return '';
    const prefix = selectedCountry.dial_code;
    if (value.startsWith(prefix)) {
      const raw = value.slice(prefix.length).trim();
      return formatPhoneNumber(selectedCountry.code, raw);
    }
    return formatPhoneNumber(selectedCountry.code, value);
  };

  const handleCountrySelect = (country: typeof COUNTRY_CODES[0]) => {
    if (disabled) return;
    const currentNumber = getPhoneNumber();
    setSelectedCountry(country);
    setOpen(false);
    onChange(`${country.dial_code} ${currentNumber}`);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const newNumber = e.target.value;
    const formatted = formatPhoneNumber(selectedCountry.code, newNumber);
    onChange(`${selectedCountry.dial_code} ${formatted}`.trim());
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (!disabled) setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-[140px] justify-between px-3 shrink-0"
          >
            <span className="flex items-center gap-2 truncate">
              <span className="text-lg">{selectedCountry.flag}</span>
              <span className="text-muted-foreground">{selectedCountry.dial_code}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Procurar país..." />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {COUNTRY_CODES.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} ${country.dial_code}`}
                    onSelect={() => handleCountrySelect(country)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCountry.code === country.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2 text-lg">{country.flag}</span>
                    <span className="font-medium flex-1">{country.name}</span>
                    <span className="text-muted-foreground ml-2">{country.dial_code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        name={name}
        type="tel"
        placeholder={placeholder || "912 345 678"}
        value={getPhoneNumber()}
        onChange={handlePhoneChange}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  )
}
