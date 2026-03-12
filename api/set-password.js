export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Look up user by email using admin API
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        }
      }
    );
    const listData = await listRes.json();
    const existingUser = listData.users?.[0];

    if (existingUser) {
      // User exists — update password and ensure email is confirmed
      const updateRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password,
            email_confirmed_at: new Date().toISOString(),
          })
        }
      );
      if (!updateRes.ok) {
        const err = await updateRes.json();
        return res.status(500).json({ error: err.message || 'Failed to update user' });
      }
      return res.status(200).json({ status: 'updated' });
    } else {
      // New user — create with password and pre-confirmed email
      const createRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            email_confirmed_at: new Date().toISOString(),
          })
        }
      );
      if (!createRes.ok) {
        const err = await createRes.json();
        return res.status(500).json({ error: err.message || 'Failed to create user' });
      }
      return res.status(200).json({ status: 'created' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
