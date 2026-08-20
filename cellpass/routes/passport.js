const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { findUserByPassportId, updateUser } = require('../lib/store');
const { buildMetrics } = require('../lib/metrics');

const router = express.Router();

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// Full dashboard payload for the logged-in owner
router.get('/dashboard', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), metrics: buildMetrics(req.user) });
});

// Simulate an accredited lab locking a certified result to the passport
router.post('/certify', requireAuth, (req, res) => {
  const updated = updateUser(req.user.id, {
    verification: 'certified',
    certifiedAt: new Date().toISOString(),
  });
  res.json({ user: publicUser(updated), metrics: buildMetrics(updated) });
});

// Public JSON, e.g. for other systems / the mobile app
router.get('/verify/:passportId.json', (req, res) => {
  const user = findUserByPassportId(req.params.passportId);
  if (!user) return res.status(404).json({ error: 'Passport not found' });
  const metrics = buildMetrics(user);
  res.json({
    passportId: user.passportId,
    owner: user.name,
    batteryType: user.batteryType,
    verification: user.verification,
    soh: metrics.soh,
    safety: metrics.safety,
    issuedBy: 'CellPass Certified Labs Network',
  });
});

// Public, server-rendered "verified" webpage — this is what the QR code
// on the PDF / dashboard points to.
router.get('/verify/:passportId', (req, res) => {
  const user = findUserByPassportId(req.params.passportId);
  if (!user) {
    return res.status(404).send(renderVerifyPage(null));
  }
  const metrics = buildMetrics(user);
  res.send(renderVerifyPage({ user, metrics }));
});

function renderVerifyPage(data) {
  if (!data) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Passport not found — CellPass</title>
      <style>body{background:#0E1420;color:#E7DFCB;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
      </head><body><div><h1>Passport not found</h1><p>No CellPass record matches this ID.</p></div></body></html>`;
  }
  const { user, metrics } = data;
  const certified = user.verification === 'certified';
  const stampColor = certified ? '#2FBF8F' : '#E2A33D';
  const stampLabel = certified ? 'CERTIFIED' : 'ESTIMATED';
  const stampSub = certified ? 'ACCREDITED LAB TEST' : 'FROM FIELD DATA';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${user.passportId} — CellPass verification</title>
<style>
  body{background:radial-gradient(ellipse at 50% 0%, #16321f, #0E1420 60%);color:#E7DFCB;font-family:'Segoe UI',Inter,sans-serif;margin:0;min-height:100vh}
  .wrap{max-width:640px;margin:0 auto;padding:80px 24px;text-align:center}
  h1{font-size:26px;margin-bottom:8px}
  p.sub{color:#8C96AA;font-size:14px;margin-bottom:28px}
  .card{background:#161F30;border:1px solid #2A3245;border-radius:16px;padding:28px;text-align:left;margin-top:20px}
  .line{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #2A3245;font-size:13.5px}
  .line:last-child{border-bottom:none}
  .badge{display:inline-block;font-family:monospace;font-size:12px;letter-spacing:2px;padding:6px 14px;border-radius:20px;border:2px solid ${stampColor};color:${stampColor};margin-bottom:6px}
  .badge-sub{display:block;font-family:monospace;font-size:9px;letter-spacing:1px;color:${stampColor};opacity:.8;margin-bottom:22px}
  .disclaimer{color:#8C96AA;font-size:11.5px;margin-top:26px}
</style>
</head><body>
  <div class="wrap">
    <span class="badge">${stampLabel}</span>
    <span class="badge-sub">${stampSub}</span>
    <h1>${certified ? 'This passport is verified' : 'This passport is field-estimated'}</h1>
    <p class="sub">${certified
      ? 'An accredited lab result has been locked to this record.'
      : 'This record reflects continuously updated field data, not a certified lab result.'}</p>
    <div class="card">
      <div class="line"><span>Passport ID</span><span>${user.passportId}</span></div>
      <div class="line"><span>Owner</span><span>${escapeHtml(user.name)}</span></div>
      <div class="line"><span>Battery format</span><span>${escapeHtml(user.batteryType)}</span></div>
      <div class="line"><span>State of health</span><span>${metrics.soh}%</span></div>
      <div class="line"><span>Safety status</span><span>${metrics.safety}</span></div>
      <div class="line"><span>Issued by</span><span>CellPass Certified Labs Network</span></div>
    </div>
    <p class="disclaimer">Estimates are informational and support decision-making — they do not replace certified laboratory testing.</p>
  </div>
</body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

module.exports = router;
module.exports.renderVerifyPage = renderVerifyPage;
