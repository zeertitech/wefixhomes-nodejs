export function verificationCodeEmail(code: string) {
  const subject = 'Your Shanandra verification code';
  const text = `Your Shanandra verification code is ${code}. It expires in 10 minutes. If you did not create an account, you can ignore this email.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4efe6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#1c160f;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <div style="font-size:22px;letter-spacing:0.22em;color:#e4c27a;">SHANANDRA</div>
              <div style="margin-top:6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.28em;color:#b7a48a;">ETHNIC COUTURE</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;text-align:center;font-family:Arial,sans-serif;color:#f6f1e7;">
              <p style="margin:0;font-size:16px;line-height:1.5;">Confirm your email</p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#cbbba6;">Use this code to finish creating your account. It expires in 10 minutes.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px;">
              <div style="display:inline-block;padding:14px 28px;border:1px solid #c9973a;border-radius:12px;font-family:Arial,sans-serif;font-size:28px;letter-spacing:0.4em;color:#e4c27a;">${code}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#9c8b76;">
              If you did not request this, you can ignore this email. We will not create a verified account without this code.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
