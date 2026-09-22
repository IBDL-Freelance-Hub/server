export interface AssessmentCredentialOutput {
  username: string;
  password: string;
  accessUrl: string;
  isPoolExhausted: boolean;
}

export interface BuildWelcomeEmailParams {
  firstName: string;
  activationUrl: string;
  clientUrl: string;
  claimedCredential: AssessmentCredentialOutput;
  cpatLink?: string;
  mdLink?: string;
  logos?: {
    ibdlLogoUrl?: string;
    pqpLogoUrl?: string;
    cpatLogoUrl?: string;
    mdLogoUrl?: string;
  };
}

/**
 * Builds the official responsive HTML template for the IBDL Freelancers Hub Welcome Email.
 * Highlights the Essential Membership, activation CTA, and the 3 diagnostic assessments with branded logos.
 */
export function buildWelcomeEmailHtml(params: BuildWelcomeEmailParams): string {
  const {
    firstName,
    activationUrl,
    clientUrl,
    claimedCredential,
    cpatLink = 'https://cpat.ibdl.net/start',
    mdLink = 'https://managementdrives.ibdl.net/start',
    logos = {},
  } = params;

  const ibdlLogoUrl = logos.ibdlLogoUrl || process.env.PUBLIC_LOGO_URL || 'cid:ibdl-logo';
  const pqpLogoUrl = logos.pqpLogoUrl || process.env.PUBLIC_PQP_LOGO_URL || 'cid:pqp-logo';
  const cpatLogoUrl = logos.cpatLogoUrl || process.env.PUBLIC_CPAT_LOGO_URL || 'cid:cpat-logo';
  const mdLogoUrl = logos.mdLogoUrl || process.env.PUBLIC_MD_LOGO_URL || 'cid:md-logo';

  const pqpLink = claimedCredential.accessUrl.startsWith('http')
    ? claimedCredential.accessUrl
    : `https://${claimedCredential.accessUrl}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Freelancers Hub</title>
</head>
<body style="margin:0; padding:0; background-color:#F0F0F3; font-family:Calibri, Arial, sans-serif;">

<!-- Preheader (hidden preview text) -->
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">
  Your Essential Membership is active, and your 3 free assessments are ready.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F0F0F3; padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:12px; overflow:hidden;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td align="center" style="background-color:#1D1D39; padding:32px 24px 26px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td align="center">
                  <img src="${ibdlLogoUrl}" width="240" alt="IBDL - Elevate Learning Impact" style="display:block; width:240px; max-width:100%; height:auto; margin:0 auto; border:0;" />
                </td>
              </tr>
            </table>
            <div style="color:#FFFFFF; font-size:12px; letter-spacing:2px; margin-top:14px; opacity:0.8; font-family:'Segoe UI', Roboto, Arial, sans-serif; text-transform:uppercase; font-weight:600;">
              FREELANCERS HUB &nbsp;|&nbsp; POWERED BY IBDL
            </div>
          </td>
        </tr>

        <!-- ===== EYEBROW + HEADLINE ===== -->
        <tr>
          <td style="padding:40px 40px 0 40px;">
            <div style="color:#E11119; font-size:13px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">
              Welcome to the Hub
            </div>
            <h1 style="color:#1D1D39; font-size:28px; font-weight:bold; margin:12px 0 0 0; line-height:1.3;">
              You're in, ${firstName}.
            </h1>
          </td>
        </tr>

        <!-- ===== BODY COPY ===== -->
        <tr>
          <td style="padding:16px 40px 0 40px;">
            <p style="color:#4A4A4A; font-size:15px; line-height:1.6; margin:0 0 12px 0;">
              Your free <strong>Essential Membership</strong> is active — no card needed, and it stays free.
              You now have everything you need to start building visibility for your training practice.
            </p>
            <p style="color:#4A4A4A; font-size:15px; line-height:1.6; margin:0;">
              As a welcome gift, we've unlocked <strong>complimentary access to all three</strong> of IBDL's
              professional diagnostic assessments below — normally reserved for paid memberships.
            </p>
          </td>
        </tr>

        <!-- ===== PRIMARY CTA ===== -->
        <tr>
          <td align="center" style="padding:28px 40px 8px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background-color:#E11119; border-radius:28px;">
                  <a href="${activationUrl}" style="display:inline-block; padding:14px 32px; color:#FFFFFF; font-size:15px; font-weight:bold; text-decoration:none;">
                    Activate Account &amp; Set Password →
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#6B6B76; font-size:12px; margin-top:12px; text-align:center;">
              This activation link is valid for 10 minutes. If expired, request a new one at <a href="${clientUrl}/activate" style="color:#E11119;">${clientUrl}/activate</a>.
            </p>
          </td>
        </tr>

        <!-- ===== SECTION DIVIDER ===== -->
        <tr>
          <td style="padding:36px 40px 20px 40px;">
            <div style="border-top:1px solid #ECECEF;"></div>
          </td>
        </tr>

        <!-- ===== 3 FREE ASSESSMENTS INTRO ===== -->
        <tr>
          <td style="padding:0 40px;">
            <h2 style="color:#1D1D39; font-size:19px; font-weight:bold; margin:0 0 6px 0;">
              Your 3 Free Assessments
            </h2>
            <p style="color:#6B6B76; font-size:14px; line-height:1.6; margin:0 0 24px 0;">
              Complimentary as part of Phase 1 of Freelancers Hub. Specimen access details for each are below.
            </p>
          </td>
        </tr>

        <!-- ===== ASSESSMENT GRID (3 cards with official logos) ===== -->
        <tr>
          <td style="padding:0 24px 8px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>

                <!-- Card 1 — PQP -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="height:36px; margin-bottom:8px;">
                          <tr>
                            <td valign="middle">
                              <img src="${pqpLogoUrl}" alt="PQP Logo" height="32" style="display:block; height:32px; max-width:85px; width:auto; object-fit:contain; border:0;" />
                            </td>
                          </tr>
                        </table>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:8px;">
                          PQP™
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Personality &amp; Qualities Profile — 20 behavioural dimensions.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${pqpLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Card 2 — CPAT -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="height:36px; margin-bottom:8px;">
                          <tr>
                            <td valign="middle">
                              <img src="${cpatLogoUrl}" alt="CPAT Logo" height="32" style="display:block; height:32px; max-width:85px; width:auto; object-fit:contain; border:0;" />
                            </td>
                          </tr>
                        </table>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:8px;">
                          CPAT™
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Competency &amp; capability evaluator across technical &amp; managerial skills.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${cpatLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

                <!-- Card 3 — Management Drives -->
                <td width="33.33%" valign="top" style="padding:0 8px 16px 8px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7FA; border-radius:10px;">
                    <tr>
                      <td style="padding:18px 16px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" style="height:36px; margin-bottom:8px;">
                          <tr>
                            <td valign="middle">
                              <img src="${mdLogoUrl}" alt="Management Drives Logo" height="30" style="display:block; height:30px; max-width:95px; width:auto; object-fit:contain; border:0;" />
                            </td>
                          </tr>
                        </table>
                        <div style="color:#1D1D39; font-size:15px; font-weight:bold; margin-top:8px;">
                          Management&nbsp;Drives®
                        </div>
                        <div style="color:#6B6B76; font-size:12px; line-height:1.5; margin-top:4px; min-height:48px;">
                          Leadership &amp; drive dynamics across 6 core behavioural drives.
                        </div>
                        <div style="border-top:1px solid #E4E4EA; margin:12px 0;"></div>
                        <div style="color:#6B6B76; font-size:11.5px; line-height:1.7;">
                          Username: <strong style="color:#1D1D39;">${claimedCredential.username}</strong><br>
                          Password: <strong style="color:#1D1D39;">${claimedCredential.password}</strong>
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                          <tr>
                            <td align="center" style="background-color:#E11119; border-radius:16px;">
                              <a href="${mdLink}" style="display:block; padding:8px 0; color:#FFFFFF; font-size:11.5px; font-weight:bold; text-decoration:none;">
                                Start Assessment
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>

              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== NOTE STRIP ===== -->
        <tr>
          <td style="padding:8px 40px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF6F1; border-radius:8px;">
              <tr>
                <td style="padding:14px 18px; color:#2E6B45; font-size:12.5px; line-height:1.6;">
                  ✓ Specimen credentials for demonstration only, tied to your account. If an assessment is
                  temporarily unavailable, your access stays linked until it returns.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== SIGN-OFF ===== -->
        <tr>
          <td align="center" style="padding:0 40px 36px 40px;">
            <div style="color:#1D1D39; font-size:16px; font-style:italic;">
              Welcome aboard,
            </div>
            <div style="color:#1D1D39; font-size:16px; font-weight:bold; margin-top:4px;">
              The Freelancers Hub Team
            </div>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td style="background-color:#F7F7FA; padding:28px 40px; border-top:1px solid #ECECEF;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:14px;">
                  <a href="https://www.linkedin.com/company/ibdl-learning-group" style="display:inline-block; width:30px; height:30px; background-color:#1D1D39; border-radius:50%; text-align:center; line-height:30px; margin:0 4px; text-decoration:none;">
                    <span style="color:#FFFFFF; font-size:13px;">in</span>
                  </a>
                  <a href="https://ibdl.net" style="display:inline-block; width:30px; height:30px; background-color:#1D1D39; border-radius:50%; text-align:center; line-height:30px; margin:0 4px; text-decoration:none;">
                    <span style="color:#FFFFFF; font-size:13px;">🌐</span>
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="color:#9A9AA5; font-size:11.5px; line-height:1.6;">
                  IBDL Learning Group &nbsp;·&nbsp; freelancers.hub@ibdl.net<br>
                  You're receiving this because you registered with Freelancers Hub.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
