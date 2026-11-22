// Fail closed: only an explicit false removes the prototype guard.
export function prototypeEnabled(value = process.env.ATELIER_PROTOTYPE_MODE) {
  return value !== "false";
}
