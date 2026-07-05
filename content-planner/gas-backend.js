// ================================================================
// 本週內容計畫工具 — Google Apps Script 後端
// 功能：
//   1. 接收前端 prompt → 呼叫 Claude API → 回傳 JSON 結果
//   2. 接收存檔請求 → 寫入 Google Sheets（多人共用）
//
// 部署步驟：
//   1. 在 Google Sheets 建一份新試算表，複製試算表 ID
//   2. 到 Extensions → Apps Script → 貼上這段程式碼
//   3. 把下方 SHEET_ID 和 CLAUDE_API_KEY 填入
//   4. Deploy → New deployment → Web app
//      → Execute as: Me
//      → Who has access: Anyone
//   5. 複製部署網址，貼到前端工具的「後端設定」欄位
// ================================================================

const CLAUDE_API_KEY = 'sk-ant-xxxxxxxxxxxx'; // ← 換成你的 Claude API Key
const SHEET_ID       = 'xxxxxxxxxxxxxxxxxxxx'; // ← 換成你的 Google Sheets ID
const SHEET_NAME     = '內容計畫';              // ← Sheets 的工作表名稱（可自訂）

// ── 入口：處理 POST 請求 ──
function doPost(e) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(e.postData.contents);

    // 存檔模式
    if (body.action === 'save') {
      savePlanToSheets(body.plan);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 生成模式：呼叫 Claude API
    const result = callClaude(body.prompt);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 處理 OPTIONS preflight（CORS 用）──
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: '內容計畫工具後端正常運行' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 呼叫 Claude API ──
function callClaude(prompt) {
  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const raw    = response.getContentText();

  if (status !== 200) {
    throw new Error(`Claude API 回應 ${status}：${raw.substring(0, 200)}`);
  }

  const apiData = JSON.parse(raw);
  const text    = apiData.content[0].text;

  // 清理可能的 markdown 包裝
  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

// ── 存入 Google Sheets ──
function savePlanToSheets(plan) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);

  // 若工作表不存在，自動建立並加標題列
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['存檔時間', '週期', '週次', '發文日', '主題標題', '切角', '開場鉤子', '平台', '優先度', '狀態'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const now     = new Date();
  const timeStr = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  const weekNum = getWeekNumber(now);
  const weekLabel = plan.week_label || '';

  // 每則貼文寫一列
  const rows = (plan.posts || []).map(post => [
    timeStr,
    weekLabel,
    `第 ${weekNum} 週`,
    post.day        || '',
    post.title      || '',
    post.angle      || '',
    post.hook       || '',
    (post.platforms || []).join('、'),
    post.priority   || '',
    '待發'           // 狀態欄：館長/小編可手動改為「已發」「跳過」
  ]);

  if (rows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

// ── 取得當年第幾週 ──
function getWeekNumber(date) {
  const d   = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
