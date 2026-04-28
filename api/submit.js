const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      clientName,
      phone,
      procedureType,
      medicalConditions,
      otherMedical,
      consents,
      submittedAt
    } = req.body;

    // FIX for Node 18+ ERR_OSSL_UNSUPPORTED:
    // Unescape \n from env var, strip PEM headers, re-wrap base64
    // in strict 64-char lines — required by Node 18 OpenSSL.
    const rawKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

    const keyBody = rawKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const wrapped = keyBody.match(/.{1,64}/g).join('\n');
    const cleanKey = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;

    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: cleanKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByIndex[0];

    try {
      await sheet.loadHeaderRow();
    } catch (e) {
      await sheet.setHeaderRow([
        'Submitted At',
        'Client Name',
        'WhatsApp Number',
        'Procedure Type',
        'Medical Conditions',
        'Other Medical Notes',
        'Consent Declarations',
        'Reference ID'
      ]);
    }

    const refId = 'AL-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);

    await sheet.addRow({
      'Submitted At': submittedAt || new Date().toISOString(),
      'Client Name': clientName || '',
      'WhatsApp Number': phone || '',
      'Procedure Type': procedureType || '',
      'Medical Conditions': medicalConditions || '',
      'Other Medical Notes': otherMedical || '',
      'Consent Declarations': consents || '',
      'Reference ID': refId
    });

    return res.status(200).json({ success: true, refId });

  } catch (error) {
    console.error('Sheets error:', error);
    return res.status(500).json({ error: error.message });
  }
};
