const express = require('express');
const env = require('../config/env');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.get('/google-sheets', (req, res) => {
  const clubs = Object.fromEntries(
    Object.entries(env.googleSheetsPorClub).map(([club, config]) => [
      club,
      {
        spreadsheetConfigured: Boolean(config.spreadsheetId),
        gidConfigured: Boolean(config.gid),
        serviceAccountConfigured: Boolean(env.googleServiceAccount.email && env.googleServiceAccount.privateKey),
      },
    ])
  );

  res.json({ clubs });
});

module.exports = router;
