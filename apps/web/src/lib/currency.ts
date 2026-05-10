import { useAuth } from "./auth";

export function formatCurrency(
  amount: number,
  currency: string,
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...opts,
  }).format(amount);
}

export function useCurrency(): string {
  const { org } = useAuth();
  return org?.currency ?? "USD";
}
