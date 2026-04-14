export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createStreamCollector(stream: ReadableStream<Uint8Array>): {
  getText: () => string;
  done: Promise<void>;
} {
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const done = stream
    .pipeTo(
      new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(decoder.decode(chunk, { stream: true }));
        },
        close() {
          const tail = decoder.decode();
          if (tail) chunks.push(tail);
        },
      }),
    )
    .catch(() => {
      const tail = decoder.decode();
      if (tail) chunks.push(tail);
    });

  return { getText: () => chunks.join(""), done };
}

export function reconstructFinalFrame(ansiOutput: string, width = 100, height = 30): string {
  const buffer = Array.from({ length: height }, () => Array(width).fill(" "));
  let row = 0;
  let col = 0;
  let index = 0;

  while (index < ansiOutput.length) {
    const current = ansiOutput[index]!;
    if (current === "\u001b") {
      const next = ansiOutput[index + 1];
      if (next === "[") {
        const start = index + 2;
        let end = start;
        while (end < ansiOutput.length && !/[A-Za-z]/.test(ansiOutput[end]!)) end += 1;
        const command = ansiOutput[end] ?? "";
        const params = ansiOutput
          .slice(start, end)
          .split(";")
          .map((part) => Number.parseInt(part || "0", 10));
        if ((command === "H" || command === "f") && params.length >= 2) {
          row = Math.min(height - 1, Math.max(0, (params[0] || 1) - 1));
          col = Math.min(width - 1, Math.max(0, (params[1] || 1) - 1));
        } else if (command === "G" && params.length >= 1) {
          col = Math.min(width - 1, Math.max(0, (params[0] || 1) - 1));
        } else if (command === "K") {
          const mode = params[0] ?? 0;
          if (mode === 2) for (let x = 0; x < width; x += 1) buffer[row]![x] = " ";
          else if (mode === 1) for (let x = 0; x <= col; x += 1) buffer[row]![x] = " ";
          else for (let x = col; x < width; x += 1) buffer[row]![x] = " ";
        } else if (command === "J" && (params[0] ?? 0) === 2) {
          for (let y = 0; y < height; y += 1)
            for (let x = 0; x < width; x += 1) buffer[y]![x] = " ";
          row = 0;
          col = 0;
        }
        index = end + 1;
        continue;
      }
      if (next === "]") {
        const oscEndByBell = ansiOutput.indexOf("\u0007", index + 2);
        const oscEndBySt = ansiOutput.indexOf("\u001b\\", index + 2);
        if (oscEndByBell >= 0 && (oscEndBySt < 0 || oscEndByBell < oscEndBySt))
          index = oscEndByBell + 1;
        else if (oscEndBySt >= 0) index = oscEndBySt + 2;
        else index += 2;
        continue;
      }
      index += 2;
      continue;
    }

    if (current === "\r") {
      col = 0;
      index += 1;
      continue;
    }
    if (current === "\n") {
      row = Math.min(height - 1, row + 1);
      col = 0;
      index += 1;
      continue;
    }
    if (current < " " || current === "\u007f") {
      index += 1;
      continue;
    }
    if (row >= 0 && row < height && col >= 0 && col < width) buffer[row]![col] = current;
    col = Math.min(width - 1, col + 1);
    index += 1;
  }

  return buffer.map((line) => line.join("").trimEnd()).join("\n");
}
