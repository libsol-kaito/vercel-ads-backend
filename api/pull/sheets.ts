import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const sheetId = (req.query.sheetId as string) || process.env.SHEETS_ID!;
    const range   = (req.query.range as string)   || process.env.SHEETS_RANGE || "Sheet1!A1:H9999";
    if (!sheetId) return res.status(400).json({ ok:false, error:"Missing sheetId" });

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT!;
    const jsonStr = (() => {
      try { return Buffer.from(raw, "base64").toString("utf-8"); } catch { return raw; }
    })();
    const creds = JSON.parse(jsonStr);

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });
    const sheets = google.sheets({ version: "v4", auth });

    const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const rows = r.data.values || [];
    if (rows.length < 2) return res.status(200).json({ ok:true, source:"sheets", data: [] });

    const header = rows[0].map(h => (h || "").toString().trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const out = rows.slice(1).map(row => {
      const val = (i: number) => (row[i] ?? "").toString().trim();
      const date = val(idx("date")) || val(idx("日付")) || val(idx("day"));
      const channel = val(idx("channel")) || val(idx("チャネル")) || "Sheet";
      const campaign = val(idx("campaign")) || val(idx("キャンペーン")) || "";
      const impressions = Number(val(idx("impressions")) || 0);
      const clicks = Number(val(idx("clicks")) || 0);
      const spend = Number(val(idx("spend")) || 0);
      const conversions = Number(val(idx("conversions")) || 0);
      const revenue = Number(val(idx("revenue")) || 0);
      const tags = (val(idx("tags")) || "").split(/[, \t]+/).filter(Boolean);
      return { date, channel, campaign, impressions, clicks, spend, conversions, revenue, tags };
    }).filter(r => r.date);

    res.status(200).json({ ok:true, source:"sheets", data: out });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
