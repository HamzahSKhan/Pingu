const { Resend } = require("resend");

const DEFAULT_FROM = "Pingu Quiz <onboarding@resend.dev>";
const DEFAULT_TO = "hamzahskhan9@gmail.com";

function cleanEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function normalizeEmail(value, fallback) {
  const email = cleanEnv(value).toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : fallback;
}

function normalizeFrom(value) {
  const from = cleanEnv(value) || DEFAULT_FROM;
  const plain = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const named = /^.+\s<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;
  return plain.test(from) || named.test(from) ? from : DEFAULT_FROM;
}

const TO_EMAIL = normalizeEmail(process.env.PRIZE_NOTIFY_EMAIL, DEFAULT_TO);
const FROM_EMAIL = normalizeFrom(process.env.RESEND_FROM);

const PRIZES = {
  "A \"Pingu's Choice\" Date":
    "You win: one date, entirely planned by me, where you get to choose everything. Food, activity, vibe. I'm just there to make it happen.",
  "A Handwritten Letter":
    "You win: a handwritten letter from me, sealed and delivered, about all the things I don't say enough.",
  "A Personal Playlist":
    "You win: a playlist I've made just for you. Every song reminds me of you in some way.",
  "A \"Yes Day\"":
    "You win: one day where I say yes to whatever you ask. Within reason. Don't abuse it. 😌",
  "A \"Get Out of Jail Free\" Card":
    "You win: one official pardon for any future ragebaiting. Use it wisely. It expires in 24 hours because I can't help myself.",
  "A \"Cookie Delivery\" Voucher":
    "You win: one cookie delivery, anywhere in London, on demand. I will drive. I will not complain. I will pretend it's not out of my way.",
  "A \"You Were Right\" Badge":
    "You win: one official acknowledgement that you were right about something. I will say it out loud. I will not argue. I will not make a face.",
  "A \"Pingu the Deadly\" Sequel":
    "You win: a new chapter of Pingu the Deadly, written by me, where you get to choose what happens next. Within reason. Don't make me fight another dragon.",
  "A Custom 3D Print":
    "You win: the 3D printed throne room I've been working on. You and me, on the throne, forever.",
  "A \"First Date\" Reenactment":
    "You win: a re-do of our first date. Same arcade, same vibe, but this time I'll be less awkward. Maybe.",
  "A \"Choose Your Adventure\" Book":
    "You win: a short story written for you, where you make the choices. It's your world. I'm just living in it.",
  "A Promise":
    "You win: a promise. One thing I'll do for you, no questions asked. You just have to tell me what it is."
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Missing RESEND_API_KEY" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const prizeTitle = typeof body.prizeTitle === "string" ? body.prizeTitle.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const score = Number.isFinite(Number(body.score)) ? Number(body.score) : null;
  const total = Number.isFinite(Number(body.total)) ? Number(body.total) : 20;
  const description = PRIZES[prizeTitle];

  if (!description) {
    return res.status(400).json({ error: "Unknown prize" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const scoreLine = score === null ? "Score unknown" : `${score} / ${total}`;
  const subject = `Pingu unlocked a prize: ${prizeTitle}`;
  const text = [
    "Pingu picked a prize.",
    "",
    `Prize: ${prizeTitle}`,
    category ? `Category: ${category}` : null,
    `Score: ${scoreLine}`,
    "",
    "What you need to do:",
    description,
    "",
    "Go make it happen, softie bear."
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #243328; line-height: 1.5;">
      <p style="margin: 0 0 12px;">Pingu picked a prize.</p>
      <p style="margin: 0 0 8px;"><strong>Prize:</strong> ${escapeHtml(prizeTitle)}</p>
      ${category ? `<p style="margin: 0 0 8px;"><strong>Category:</strong> ${escapeHtml(category)}</p>` : ""}
      <p style="margin: 0 0 16px;"><strong>Score:</strong> ${escapeHtml(scoreLine)}</p>
      <p style="margin: 0 0 6px;"><strong>What you need to do:</strong></p>
      <p style="margin: 0; padding: 12px 14px; background: #f7f1e6; border-radius: 12px;">${escapeHtml(description)}</p>
      <p style="margin: 18px 0 0; color: #3f6d4c;">Go make it happen, softie bear.</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      text,
      html
    });

    if (error) {
      return res.status(502).json({ error: error.message || "Failed to send email" });
    }

    return res.status(200).json({ ok: true, id: data && data.id });
  } catch (err) {
    return res.status(502).json({ error: err.message || "Failed to send email" });
  }
};
