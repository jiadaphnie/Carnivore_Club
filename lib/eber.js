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

function getTierNames(user) {
  return (user.member_tiers || []).map(tier => tier.name).filter(Boolean);
}

module.exports = { getTierNames, getUser };