// POST /api/subscribe  { name, email, company(honeypot) }
// Adds the subscriber to a MailerLite group. With double opt-in enabled in the
// MailerLite account, MailerLite sends the confirmation email; the group's
// automation delivers the checklist after they confirm.
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   MAILERLITE_API_KEY   – your MailerLite API token
//   MAILERLITE_GROUP_ID  – the id of the group the delivery automation is attached to

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase();
    const honeypot = String(body.company || '').trim();

    // Bot submitted the hidden field — silently accept, do nothing.
    if (honeypot) return res.status(200).json({ ok: true });

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !emailOk) {
      return res.status(400).json({ ok: false, error: 'Please enter your name and a valid email.' });
    }

    const API_KEY = process.env.MAILERLITE_API_KEY;
    const GROUP_ID = process.env.MAILERLITE_GROUP_ID;
    if (!API_KEY || !GROUP_ID) {
      console.error('Missing MAILERLITE_API_KEY or MAILERLITE_GROUP_ID');
      return res.status(500).json({ ok: false, error: 'Signup is temporarily unavailable.' });
    }

    const r = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        email,
        fields: { name },
        groups: [GROUP_ID]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('MailerLite error', r.status, detail);
      return res.status(502).json({ ok: false, error: 'Could not sign you up right now — try again in a moment.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe handler error', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
