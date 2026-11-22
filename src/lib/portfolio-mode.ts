// Portfolio use does not remove the prototype's audience/SEO/test-data safeguards.
export function functionalPortfolioEnabled(
  value = process.env.NEXT_PUBLIC_FUNCTIONAL_PORTFOLIO,
) {
  return value === "true";
}
export function portfolioWriteContext({
  prototype,
  functional,
  databaseSynthetic,
}: {
  prototype: boolean;
  functional: boolean;
  databaseSynthetic: boolean;
}) {
  return !prototype || (functional && databaseSynthetic);
}
