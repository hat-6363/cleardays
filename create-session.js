export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Step 1: Find or create the user via admin API
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
    let user = listData.users?.[0];

    if (!user) {
      // Create new user, pre-confirmed
      const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          email_confirmed_at: new Date().toISOString(),
          user_metadata: { signed_up_via: 'otp' }
        })
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        return res.status(500).json({ error: err.message || 'Failed to create user' });
      }
      user = await createRes.json();
    } else {
      // Ensure existing user has confirmed email
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_confirmed_at: new Date().toISOString(),
        })
      });
    }

    // Step 2: Generate a sign-in link (OTP token) for the user
    // This gives us a token we can exchange for a real session
    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}/generate-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email,
      })
    });

    if (!linkRes.ok) {
      const err = await linkRes.json();
      return res.status(500).json({ error: err.message || 'Failed to generate session link' });
    }

    const linkData = await linkRes.json();

    // The response contains hashed_token and a properties object
    // We need to exchange the token for a session using the anon key
    const token = linkData.properties?.hashed_token || linkData.hashed_token;

    if (!token) {
      return res.status(500).json({ error: 'No token in link response', debug: linkData });
    }

    // Exchange the hashed token for a session
    const sessionRes = await fetch(
      `${SUPABASE_URL}/auth/v1/verify?token=${token}&type=magiclink&redirect_to=`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
        },
        redirect: 'manual' // Don't follow redirects — the session is in the redirect URL
      }
    );

    // The session tokens are embedded in the redirect Location header as a fragment
    const location = sessionRes.headers.get('location') || '';
    const fragmentMatch = location.match(/access_token=([^&]+).*refresh_token=([^&]+)/);

    if (fragmentMatch) {
      return res.status(200).json({
        access_token: decodeURIComponent(fragmentMatch[1]),
        refresh_token: decodeURIComponent(fragmentMatch[2]),
      });
    }

    // Fallback: return the raw token so client can try verifyOtp
    return res.status(200).json({
      fallback_token: token,
      debug_location: location,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
