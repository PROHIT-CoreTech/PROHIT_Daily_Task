import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string) {
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? "PROHIT Daily Task <no-reply@example.com>",
    to,
    subject,
    html,
  });
}

export function reminderEmail(taskTitle: string, dueDate: Date | null | undefined) {
  return {
    subject: `Sticky Alert: ${taskTitle}`,
    html: `
      <div style="font-family: sans-serif; color: #1B2A4A;">
        <h2 style="color: #1B2A4A;">Sticky Alert</h2>
        <p>Your task is due${dueDate ? ` on <strong>${dueDate.toLocaleString()}</strong>` : ""}:</p>
        <p style="font-size: 18px; font-weight: 600;">${taskTitle}</p>
        <p style="color: #5C7A99;">— PROHIT Daily Task</p>
      </div>
    `,
  };
}
