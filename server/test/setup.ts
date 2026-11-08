// node:sqlite prints an ExperimentalWarning on Node 22/24: keep test output clean.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning: string | Error, ...args: unknown[]) {
  const text = typeof warning === 'string' ? warning : warning.message;
  if (text.includes('SQLite is an experimental feature')) return;
  return (originalEmitWarning as (...a: unknown[]) => void).call(process, warning, ...args);
} as typeof process.emitWarning;
