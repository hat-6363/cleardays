export default async function handler(req, res) {
  // Allow CORS from our own site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });

  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Joydays <hello@joydays.co>',
        to: [email],
        subject: `Your Joydays sign-in code: ${code}`,
        html: `
          <div style="font-family:'Outfit',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#FDFAF5;">
            <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#1A1208;margin-bottom:8px;">☀️ Joydays</div>
            <div style="height:2px;background:#E05C1A;margin-bottom:32px;width:48px;"></div>
            <p style="font-size:16px;color:#1A1208;margin-bottom:8px;">Your sign-in code is:</p>
            <div style="font-size:48px;font-weight:700;color:#E05C1A;letter-spacing:12px;margin:20px 0;font-family:Georgia,serif;">${code}</div>
            <p style="font-size:14px;color:#4A3728;margin-bottom:24px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            <div style="border-top:1px solid #E5D9C8;padding-top:20px;font-size:12px;color:#C9B99A;">Joydays · The summer planner for busy parents</div>
          </div>`
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
