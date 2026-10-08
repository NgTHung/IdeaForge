import { z } from "zod";

const htmlTag = /<\/?[a-z][\w:-]*(?:\s[^<>]*)?\s*\/?>|<!--|<![A-Z]/i;

export function markdownTextSchema(maxLength: number, minLength = 0) {
  return z.string().trim().min(minLength).max(maxLength).refine((text) => !htmlTag.test(text), "Use Markdown instead of HTML.");
}
