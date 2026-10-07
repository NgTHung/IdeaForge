import { aiErrorResponse } from "@/lib/ai";
import {
  MAX_ASSISTANT_CARDS,
  MAX_ASSISTANT_CARD_CHARACTERS,
  MAX_ASSISTANT_HISTORY_MESSAGES,
  MAX_ASSISTANT_HISTORY_MESSAGE_CHARACTERS,
  MAX_ASSISTANT_MESSAGE_CHARACTERS,
  MAX_ASSISTANT_RELATIONSHIPS,
  MAX_ASSISTANT_RELATIONSHIP_CONDITION_CHARACTERS,
  MAX_ASSISTANT_RELATIONSHIP_EXPLANATION_CHARACTERS,
  MAX_ASSISTANT_TOTAL_CARD_CHARACTERS,
  assistantRequestSchema,
} from "@/lib/assistant";
import { askAssistant } from "@/lib/assistant-answer";

export const runtime = "nodejs";
export const maxDuration = 95;

const limitsMessage = "Keep card IDs and author names within 100 characters. Stay within " + MAX_ASSISTANT_CARDS + " cards, " +
  MAX_ASSISTANT_CARD_CHARACTERS + " combined title and content characters per card, " +
  MAX_ASSISTANT_TOTAL_CARD_CHARACTERS + " total card-text characters, " +
  MAX_ASSISTANT_RELATIONSHIPS + " relationships, relationship explanations up to " +
  MAX_ASSISTANT_RELATIONSHIP_EXPLANATION_CHARACTERS + " characters and conditions up to " +
  MAX_ASSISTANT_RELATIONSHIP_CONDITION_CHARACTERS + " characters, " +
  MAX_ASSISTANT_MESSAGE_CHARACTERS + " characters per message, and " +
  MAX_ASSISTANT_HISTORY_MESSAGES + " earlier messages of at most " +
  MAX_ASSISTANT_HISTORY_MESSAGE_CHARACTERS + " characters each.";

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return Response.json({ error: "Send valid JSON." }, { status: 400 }); }

  const parsed = assistantRequestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: limitsMessage }, { status: 400 });

  try {
    return Response.json(await askAssistant(parsed.data));
  } catch (error) {
    return aiErrorResponse(error);
  }
}
