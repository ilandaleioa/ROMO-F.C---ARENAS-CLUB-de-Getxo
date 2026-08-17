const express = require('express');
const env = require('../config/env');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/google-sheets', (req, res) => {
  const tieneServiceAccount = Boolean(env.googleServiceAccount.email && env.googleServiceAccount.privateKey);
  const tieneApiKey = Boolean(env.googleApiKey);

  const clubs = Object.fromEntries(
    Object.entries(env.googleSheetsPorClub).map(([club, config]) => [
      club,
      {
        spreadsheetConfigured: Boolean(config.spreadsheetId),
        gidConfigured: Boolean(config.gid),
        serviceAccountConfigured: tieneServiceAccount,
        apiKeyConfigured: tieneApiKey,
        canRead: Boolean(config.spreadsheetId && (config.gid || tieneServiceAccount || tieneApiKey)),
        canWrite: Boolean(config.spreadsheetId && tieneServiceAccount),
        bidirectional: Boolean(config.spreadsheetId && tieneServiceAccount),
      },
    ])
  );

  res.json({ clubs });
});

module.exports = router;
