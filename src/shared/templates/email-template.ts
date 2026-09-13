export interface BaseEmailTemplateOptions {
  title: string;
  preheader?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footnote?: string;
}

export function buildBrandEmailHtml({
  title,
  preheader = '',
  contentHtml,
  ctaText,
  ctaUrl,
  footnote,
}: BaseEmailTemplateOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F7; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>` : ''}
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F4F7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); border: 1px solid #E2E2EC;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td align="center" style="background: #141428; padding: 32px 24px; border-bottom: 4px solid #E11119;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <span style="color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: 1px; font-family: Arial, sans-serif; text-transform: uppercase;">
                      IBDL <span style="color: #E11119;">FREELANCERS HUB</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CONTENT BODY -->
          <tr>
            <td style="padding: 36px 32px; color: #16162C; text-align: left; font-size: 15px; line-height: 1.6;">
              <h1 style="margin: 0 0 20px 0; color: #141428; font-size: 22px; font-weight: 700;">
                ${title}
              </h1>
              
              ${contentHtml}

              ${
                ctaText && ctaUrl
                  ? `
                <div style="text-align: center; margin: 32px 0 24px 0;">
                  <a href="${ctaUrl}" target="_blank" style="background-color: #E11119; color: #FFFFFF; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 6px 18px rgba(225, 17, 25, 0.25);">
                    ${ctaText}
                  </a>
                </div>
                <div style="background-color: #F8F9FA; border-radius: 8px; padding: 12px 16px; border: 1px solid #E2E2EC; font-size: 12px; color: #6A6A86; word-break: break-all; margin-top: 20px;">
                  <span style="font-weight: 600; color: #141428;">Or copy and paste this link into your browser:</span><br />
                  <a href="${ctaUrl}" style="color: #E11119; text-decoration: underline;">${ctaUrl}</a>
                </div>
                `
                  : ''
              }

              ${
                footnote
                  ? `
                <hr style="border: none; border-top: 1px solid #E2E2EC; margin: 28px 0 16px 0;" />
                <p style="margin: 0; font-size: 12px; color: #6A6A86; line-height: 1.5;">
                  ${footnote}
                </p>
                `
                  : ''
              }
            </td>
          </tr>

          <!-- BRAND FOOTER -->
          <tr>
            <td style="background-color: #F8F9FA; padding: 20px 32px; text-align: center; border-top: 1px solid #E2E2EC; font-size: 12px; color: #6A6A86;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #141428;">
                © 2026 IBDL Learning Group — Freelancers Hub
              </p>
              <p style="margin: 0; font-size: 11px; color: #9A9AB0;">
                This is an automated system notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
