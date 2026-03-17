import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const text = (req.body.text || "").trim();

    if (!text) {
      return res.json({
        response_type: "ephemeral",
        text: "Use: /partner <partner_id> <YYYY-MM>"
      });
    }

    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return res.json({
        response_type: "ephemeral",
        text: "Use: /partner <partner_id> <YYYY-MM>"
      });
    }

    const partnerId = parts[0];
    const reportMonth = parts[1];

    const rows = await getSheetRows();
    const result = buildResponse(rows, partnerId, reportMonth);

    return res.json({
      response_type: "ephemeral",
      text: result
    });

  } catch (err) {
    return res.json({
      response_type: "ephemeral",
      text: "Error: " + err.message
    });
  }
}

async function getSheetRows() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: process.env.GOOGLE_SHEET_RANGE
  });

  return response.data.values || [];
}

function buildResponse(rows, partnerId, reportMonth) {
  const headers = rows[0];
  const data = rows.slice(1);

  const pIndex = headers.indexOf("partner_id");
  const mIndex = headers.indexOf("report_month");

  let result = "";

  data.forEach(row => {
    if (
      String(row[pIndex]).trim() === partnerId &&
      normalizeMonth(row[mIndex]) === reportMonth
    ) {
      result += `${row[headers.indexOf("brand_name")]} - ${row[headers.indexOf("fiat_amount_fin")]}\n`;
    }
  });

  return result || "No data found";
}

function normalizeMonth(val) {
  if (val instanceof Date) {
    return new Date(val).toISOString().slice(0, 7);
  }
  return String(val).slice(0, 7);
}