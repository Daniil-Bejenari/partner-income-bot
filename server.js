const express = require("express");
const { google } = require("googleapis");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/partner", async (req, res) => {
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

    if (!/^\d{4}-\d{2}$/.test(reportMonth)) {
      return res.json({
        response_type: "ephemeral",
        text: "Month must be in YYYY-MM format, for example: 2026-02"
      });
    }

    const rows = await getSheetRows();
    const result = buildPartnerResponse(rows, partnerId, reportMonth);

    return res.json({
      response_type: "ephemeral",
      text: result
    });
  } catch (error) {
    console.error(error);
    return res.json({
      response_type: "ephemeral",
      text: `Error: ${error.message}`
    });
  }
});

async function getSheetRows() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || "Sheet1!A:AD";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  return response.data.values || [];
}

function buildPartnerResponse(rows, partnerId, reportMonth) {
  if (!rows.length) return "No data found";

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const idx = {
    report_month: headers.indexOf("report_month"),
    partner_name: headers.indexOf("partner_name"),
    brand_name: headers.indexOf("brand_name"),
    partner_id: headers.indexOf("partner_id"),
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

  const matches = dataRows.filter((row) => {
    const rowPartnerId = String(row[idx.partner_id] || "").trim();
    const rowMonth = normalizeMonth(row[idx.report_month]);
    return rowPartnerId === partnerId && rowMonth === reportMonth;
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

function normalizeMonth(value) {
  if (!value) return "";

  const str = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }

  const date = new Date(str);
  if (!isNaN(date)) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  return str.slice(0, 7);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});