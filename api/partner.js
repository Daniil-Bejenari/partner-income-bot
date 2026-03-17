import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "Partner income endpoint is running. Use POST from Slack."
      });
    }

    const text = (req.body?.text || "").trim();

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

    if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
      return res.json({
        response_type: "ephemeral",
        text: "Month must be in YYYY-MM format, for example: 2026-02"
      });
    }

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
  if (!rows.length) return "No data found";

  const headers = rows[0];
  const data = rows.slice(1);

  const pIndex = headers.indexOf("partner_id");
  const mIndex = headers.indexOf("report_month");

  const idx = {
    partner_name: headers.indexOf("partner_name"),
    brand_name: headers.indexOf("brand_name"),
    bill_id: headers.indexOf("bill_id"),
    commission_title: headers.indexOf("commission_title"),
    ftd_count: headers.indexOf("ftd_count"),
    casino_ngr: headers.indexOf("casino_ngr"),
    revshare_fin: headers.indexOf("revshare_fin"),
    cpa_fin: headers.indexOf("cpa_fin"),
    fiat_amount_fin: headers.indexOf("fiat_amount_fin"),
    profitability: headers.indexOf("profitability"),
    checks: headers.indexOf("checks")
  };

  const matches = data.filter((row) => {
    return (
      String(row[pIndex] || "").trim() === partnerId &&
      normalizeMonth(row[mIndex]) === reportMonth
    );
  });

  if (!matches.length) {
    return `No data found for partner_id ${partnerId} in ${reportMonth}`;
  }

  const partnerName = matches[0][idx.partner_name] || "-";
  const lines = [
    `*Partner:* ${partnerName}`,
    `*Partner ID:* ${partnerId}`,
    `*Month:* ${reportMonth}`,
    ""
  ];

  matches.forEach((row, i) => {
    lines.push(`*Brand:* ${row[idx.brand_name] || "-"}`);
    lines.push(`Bill ID: ${row[idx.bill_id] || "-"}`);
    lines.push(`Commission: ${row[idx.commission_title] || "-"}`);
    lines.push(`FTD: ${row[idx.ftd_count] || "0"}`);
    lines.push(`Casino NGR: ${row[idx.casino_ngr] || "0"}`);
    lines.push(`RevShare Fin: ${row[idx.revshare_fin] || "0"}`);
    lines.push(`CPA Fin: ${row[idx.cpa_fin] || "0"}`);
    lines.push(`Fiat Amount Fin: ${row[idx.fiat_amount_fin] || "0"}`);
    lines.push(`Profitability: ${row[idx.profitability] || "0"}`);
    lines.push(`Checks: ${row[idx.checks] || "0"}`);

    if (i < matches.length - 1) {
      lines.push("--------------------");
    }
  });

  return lines.join("\n");
}

function normalizeMonth(val) {
  if (!val) return "";

  const str = String(val).trim();

  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  const date = new Date(str);
  if (!isNaN(date)) {
    return date.toISOString().slice(0, 7);
  }

  return str.slice(0, 7);
}