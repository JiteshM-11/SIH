const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const passportRoutes = require('./routes/passport');
const { findUserByPassportId } = require('./lib/store');
const { buildMetrics } = require('./lib/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/passport', passportRoutes);

// Public verification webpage / QR-code destination, e.g. /verify/CP-12345
app.get('/verify/:passportId', (req, res) => {
  const user = findUserByPassportId(req.params.passportId);
  const data = user ? { user, metrics: buildMetrics(user) } : null;
  res.status(user ? 200 : 404).send(passportRoutes.renderVerifyPage(data));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CellPass server ready → http://localhost:${PORT}`);
});
