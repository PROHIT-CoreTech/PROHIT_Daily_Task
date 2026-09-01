import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export type RecapTask = {
  title: string;
  priority: number;
  dueDate?: string;
  overdue: boolean;
};

const PRIORITY_LABEL = ["no priority", "low priority", "medium priority", "high priority"];

/**
 * Quick Recap (AI) — BRD §10.2 nomenclature for "AI Summary". Turns the
 * day's task list into a short, plain-language plan. Summarization work
 * like this doesn't benefit from high reasoning effort (skill guidance),
 * so this runs at low effort to keep the add-on's ₹99/user/month margin
 * healthy — the model itself stays Claude Opus 5 regardless.
 */
export async function generateQuickRecap(tasks: RecapTask[], firstName: string): Promise<string> {
  if (tasks.length === 0) {
    return `Nothing on your plate today, ${firstName} — a clear day to get ahead or take a break.`;
  }

  const taskLines = tasks
    .map((t) => `- "${t.title}" (${PRIORITY_LABEL[t.priority]}${t.overdue ? ", OVERDUE" : t.dueDate ? `, due ${t.dueDate}` : ""})`)
    .join("\n");

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    output_config: { effort: "low" },
    system:
      "You write a short 'Quick Recap' for a task-management app. Given a user's task list, " +
      "write 2-4 sentences in plain conversational language: what to prioritize and why, calling out " +
      "anything overdue or high-priority first. No markdown, no headers, no bullet points in your reply — just prose. " +
      "Address the user by first name once. Be warm but brisk, like a good executive assistant.",
    messages: [
      {
        role: "user",
        content: `My name is ${firstName}. Here's my task list for today:\n${taskLines}`,
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text ?? "Couldn't generate a recap this time — try again in a moment.";
}
