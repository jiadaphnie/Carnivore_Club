const EBER_API_BASE = 'https://api.eber.co/v3/public';

function eberHeaders() {
  if (!process.env.EBER_API_KEY) {
    throw new Error('EBER_API_KEY environment variable is not set');
  }

  return {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(`${process.env.EBER_API_KEY}:`).toString('base64')}`,
  };
}

async function getUser(userId) {
  if (!Number.isInteger(Number(userId))) {
    throw new Error('Eber user ID must be numeric');
  }

  const response = await fetch(`${EBER_API_BASE}/user/${userId}`, {
    headers: eberHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Eber user lookup failed: ${response.status}`);
  }

  return response.json();
}

async function listUsers({ fromDate, toDate }) {
  const url = new URL(`${EBER_API_BASE}/business/list/user`);
  url.searchParams.set('from_date', fromDate);
  url.searchParams.set('to_date', toDate);
  url.searchParams.set('limit', '100');

  const users = [];
  let nextUrl = url;
  let pages = 0;
  while (nextUrl) {
    if (++pages > 100) {
      throw new Error('Eber member listing exceeded the 100-page safety limit');
    }
    const response = await fetch(nextUrl, { headers: eberHeaders() });
    if (!response.ok) {
      throw new Error(`Eber member listing failed: ${response.status}`);
    }
    const payload = await response.json();
    users.push(...(payload.data || []));
    if (!payload.next_url) break;

    const candidate = new URL(payload.next_url);
    if (candidate.origin !== 'https://api.eber.co' || !candidate.pathname.startsWith('/v3/public/')) {
      throw new Error('Eber returned an invalid member-list next URL');
    }
    nextUrl = candidate;
  }

  return users;
}

function getTierNames(user) {
  return (user.member_tiers || []).map(tier => tier.name).filter(Boolean);
}

module.exports = { getTierNames, getUser, listUsers };