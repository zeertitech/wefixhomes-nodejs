/** Shared commercial rules. Cart display and order creation must use the same values. */
export const FREE_SHIPPING_THRESHOLD = 2000;
export const SHIPPING_FEE = 99;
export const MAX_CART_QUANTITY = 10;

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function shippingAmountFor(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_FEE;
}
