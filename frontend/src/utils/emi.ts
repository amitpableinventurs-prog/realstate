// EMI plans: the interest rate is picked automatically from the period.
// Change these to the rates Bhumi Bazar offers.
export const EMI_PLANS: { months: number; rate: number }[] = [
  { months: 3, rate: 2 },
  { months: 6, rate: 3 },
  { months: 12, rate: 5 },
  { months: 18, rate: 10 },
  { months: 24, rate: 12 },
];

/**
 * Monthly instalment on a reducing balance:
 * EMI = P × r × (1 + r)^n / ((1 + r)^n − 1), with r the monthly rate.
 */
export const calculateEmi = (principal: number, annualRatePercent: number, months: number) => {
  if (!(principal > 0) || !(months > 0)) return { emi: 0, totalInterest: 0, totalPayable: 0 };
  const r = annualRatePercent / 12 / 100;
  const emi = r === 0 ? principal / months : (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const totalPayable = emi * months;
  return { emi, totalInterest: totalPayable - principal, totalPayable };
};
