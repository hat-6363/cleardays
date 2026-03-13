import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Generate a magic link server-side — this creates the user if needed, confirmed
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (error) return res.status(500).json({ error: error.message });

    const hashed_token = data?.properties?.hashed_token;
    if (!hashed_token) return res.status(500).json({ error: 'No token returned', debug: data });

    // Return the token to the client — client will call verifyOtp with it
    return res.status(200).json({ hashed_token });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
