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
    // Ensure user exists — create if not
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) return res.status(500).json({ error: listError.message });

    let user = users.find(u => u.email === email.toLowerCase());

    if (!user) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
      });
      if (createError) return res.status(500).json({ error: createError.message });
      user = newUser.user;
    }

    // Generate a magic link — gives us a hashed_token the client can use
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
    });
    if (linkError) return res.status(500).json({ error: linkError.message });

    return res.status(200).json({
      hashed_token: linkData.properties.hashed_token,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
