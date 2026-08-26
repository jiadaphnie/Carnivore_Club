// Receives Eber XM webhook events and stores each one as its own file in
// this GitHub repo, via the GitHub Contents API. Chosen instead of a hosted
// database specifically to avoid any new billing relationship - this repo
// and a GitHub personal access token cost nothing to run.
//
// Each event is written to data/eber_events/<id>.json. One file per event
// (rather than appending to a single shared file) sidesteps the read-modify
// -write race condition that would otherwise happen if two webhook calls
// land close together - GitHub's Contents API needs the current file's SHA
// to update it, so two concurrent updates to the same file can clobber each
// other; two concurrent *creates* of different files cannot.
//
// SECURITY NOTE: signature verification is not implemented yet - still
// waiting on the HMAC secret from Eber. Until that's added, anyone who
// discovers this URL could POST fake events into the repo. See the HMAC tab
// on Eber's API page.

const GITHUB_OWNER = 'jiadaphnie';
const GITHUB_REPO = 'Carnivore_Club';
const EVENTS_DIR = 'data/eber_events';
const BRANCH = 'main';

function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function writeEvent(id, payload) {
  const path = `${EVENTS_DIR}/${id}.json`;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');

  const res = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(),
    body: JSON.stringify({
      message: `Eber webhook event ${id}`,
      content,
      branch: BRANCH,
    }),
  });

  if (res.status === 422) {
    // File already exists at this path - same event delivered twice by
    // Eber (webhooks commonly retry). Treat as already-recorded, not an error.
    return { alreadyExisted: true };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${text}`);
  }
  return { alreadyExisted: false };
}

async function listRecentEvents(limit) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${EVENTS_DIR}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: githubHeaders() });

  if (res.status === 404) {
    return []; // no events written yet
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub list failed: ${res.status} ${text}`);
  }

  const files = await res.json();
  const sorted = files
    .map(f => ({ ...f, idNum: parseInt(f.name.replace('.json', ''), 10) }))
    .filter(f => !Number.isNaN(f.idNum))
    .sort((a, b) => b.idNum - a.idNum)
    .slice(0, limit);

  return sorted.map(f => ({ id: f.idNum, path: f.path }));
}

module.exports = async (req, res) => {
  if (!process.env.GITHUB_TOKEN) {
    res.status(500).json({ error: 'GITHUB_TOKEN environment variable is not set' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const events = await listRecentEvents(20);
      res.status(200).json({ count: events.length, events });
    } catch (err) {
      console.error('Webhook list error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body;
    if (!body || !body.id) {
      res.status(400).json({ error: 'Missing event id' });
      return;
    }

    const result = await writeEvent(body.id, body);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('Webhook write error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
};
