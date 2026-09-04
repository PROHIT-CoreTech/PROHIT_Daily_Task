import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Reuses the same EMAIL_SERVER transport NextAuth's magic-link login sends
 * through, so there is one SMTP config to operate, not two.
 */
function getTransporter() {
  if (!process.env.EMAIL_SERVER) return null;
  if (!transporter) transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
  return transporter;
}

interface InviteEmail {
  to: string;
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
}

/**
 * Best-effort send. Local dev without EMAIL_SERVER configured just logs —
 * the invite row and its token already exist, so the flow is still testable
 * by hitting the accept endpoint directly.
 */
export async function sendInviteEmail(opts: InviteEmail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mail] EMAIL_SERVER not set; invite to ${opts.to} was not emailed`);
    return;
  }

  await transport.sendMail({
    to: opts.to,
    from: process.env.EMAIL_FROM,
    subject: `${opts.inviterName} invited you to ${opts.workspaceName}`,
    text: `${opts.inviterName} invited you to join ${opts.workspaceName} on PROHIT Daily Task.\n\nAccept: ${opts.acceptUrl}`,
    html: `<p>${opts.inviterName} invited you to join <strong>${opts.workspaceName}</strong> on PROHIT Daily Task.</p><p><a href="${opts.acceptUrl}">Accept invite</a></p>`,
  });
}

interface ReminderEmail {
  to: string;
  taskTitle: string;
}

/** Same best-effort/log-if-unconfigured contract as sendInviteEmail. */
export async function sendReminderEmail(opts: ReminderEmail): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mail] EMAIL_SERVER not set; reminder for "${opts.taskTitle}" to ${opts.to} was not emailed`);
    return;
  }

  await transport.sendMail({
    to: opts.to,
    from: process.env.EMAIL_FROM,
    subject: `Reminder: ${opts.taskTitle}`,
    text: `Reminder for your task "${opts.taskTitle}" on PROHIT Daily Task.`,
    html: `<p>Reminder for your task <strong>${opts.taskTitle}</strong> on PROHIT Daily Task.</p>`,
  });
}
