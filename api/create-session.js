import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Find or create user
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
    if (listError) return res.status(500).json({ error: listError.message });

    let user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
      });
      if (createError) return res.status(500).json({ error: createError.message });
      user = created.user;
    }

    // Generate magic link and extract hashed_token
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
    });
    if (linkError) return res.status(500).json({ error: linkError.message });

    const hashed_token = linkData.properties?.hashed_token;
    if (!hashed_token) return res.status(500).json({ error: 'Could not generate token' });

    // Exchange hashed_token for a real session via Supabase REST API
    const verifyRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        type: 'magiclink',
        token: hashed_token,
      }),
    });

    const session = await verifyRes.json();

    if (!verifyRes.ok || !session.access_token) {
      return res.status(500).json({ error: session.error_description || 'Failed to verify token' });
    }

    return res.status(200).json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
