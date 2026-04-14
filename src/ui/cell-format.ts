export function formatCell(value: number, notes: number[], width: number): string {
  if (value !== 0) {
    return `${String(value)
      .padStart(Math.floor((width + 1) / 2), " ")
      .padEnd(width, " ")}`;
  }

  if (notes.length === 0) {
    return " . ".padEnd(width, " ");
  }

  if (notes.length <= width) {
    return notes.join("").padEnd(width, " ");
  }

  return notes.slice(0, width).join("").padEnd(width, " ");
}
