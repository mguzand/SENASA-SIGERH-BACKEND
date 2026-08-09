const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const requestStatusMail = (
  recipientName: string,
  title: string,
  message: string,
  detailLines: string[] = [],
  actionUrl?: string,
) => `
  <div style="background:#f4f7f6;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937">
    <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dfe7e4;border-radius:16px;overflow:hidden">
      <div style="background:#087f5b;padding:22px 28px;color:#fff">
        <div style="font-size:12px;letter-spacing:2px;font-weight:700">SENASA · SIGERH</div>
        <h1 style="font-size:22px;margin:8px 0 0">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:28px">
        <p style="margin-top:0">Hola, <strong>${escapeHtml(recipientName)}</strong>.</p>
        <p style="line-height:1.6">${escapeHtml(message)}</p>
        ${
          detailLines.length
            ? `<div style="margin:22px 0;padding:16px;background:#f3f8f6;border-radius:10px">${detailLines
                .map((line) => `<div style="margin:5px 0">${escapeHtml(line)}</div>`)
                .join('')}</div>`
            : ''
        }
        ${
          actionUrl
            ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#087f5b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Abrir SIGERH</a>`
            : ''
        }
      </div>
    </div>
  </div>`;
