/**
 * Calculate a late return fine based on whole days late.
 */
export function calculateFine(
  dueDate: Date,
  returnDate: Date,
  finePerDay: number
): number {
  const diffMs = returnDate.getTime() - dueDate.getTime();
  const daysLate = Math.max(
    0,
    Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  );
  return daysLate * finePerDay;
}

