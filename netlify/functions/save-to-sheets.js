// Netlify Function：存入 Google Sheets via GAS
// 前端呼叫 /.netlify/functions/save-to-sheets
// GAS_URL 藏在 Netlify 環境變數，不暴露給前端

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const gasUrl = process.env.GAS_URL;
  if (!gasUrl) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GAS_URL 未設定，請在 Netlify 環境變數中加入 GAS_URL' })
    };
  }

  try {
    const { plan } = JSON.parse(event.body);

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', plan })
    });

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
