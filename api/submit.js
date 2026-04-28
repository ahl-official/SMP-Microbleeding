const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

export default async function handler(req, res) {
  // CORS headers
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

    // Auth
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Use first sheet or create one
    let sheet = doc.sheetsByIndex[0];
    if (!sheet) {
      sheet = await doc.addSheet({ title: 'Consent Forms' });
    }

    // Check headers
    await sheet.loadHeaderRow().catch(async () => {
      await sheet.setHeaderRow([
        'Submitted At', 'Client Name', 'WhatsApp Number',
        'Procedure Type', 'Medical Conditions', 'Other Medical Notes',
        'Consent Declarations', 'Reference ID'
      ]);
    });

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
    return res.status(500).json({ error: 'Failed to save. Please try again.' });
  }
}
