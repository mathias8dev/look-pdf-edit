import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stable-ish id generator (no crypto dependency needed client-side). */
let _counter = 0;
export function nextId(prefix = "id") {
  _counter += 1;
  return `${prefix}_${_counter}`;
}
