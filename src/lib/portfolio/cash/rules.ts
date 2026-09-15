export function shouldOfferAvailableCash(action: string, availableCash: number) {
  return action === "buy" && availableCash > 0;
}
