const headers = {
  'Content-Type': 'application/json'
};

function withApiKey(headersObj) {
  if (process.env.WHATSAPP_API_KEY) {
    return { ...headersObj, Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` };
  }

  return headersObj;
}

export async function getWhatsappSessionStatus() {
  const baseUrl = process.env.WHATSAPP_API_BASE_URL;
  const response = await fetch(`${baseUrl}/session/status`, { headers: withApiKey(headers) });

  if (!response.ok) {
    throw new Error(`WhatsApp session status failed: ${response.status}`);
  }

  return response.json();
}

export async function sendWhatsappMessage(recipient, message, fileUrl) {
  const baseUrl = process.env.WHATSAPP_API_BASE_URL;
  const payload = {
    phone: recipient,
    message,
    fileUrl: fileUrl || undefined
  };

  const response = await fetch(`${baseUrl}/message/send`, {
    method: 'POST',
    headers: withApiKey(headers),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WhatsApp send failed: ${response.status} ${text}`);
  }

  return response.json();
}
