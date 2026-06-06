import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendLicenseEmail(opts: {
  to: string
  licenseKey: string
  plan: string
  annual: boolean
}) {
  const { to, licenseKey, plan, annual } = opts

  await resend.emails.send({
    from: 'BigO <noreply@bigo.space>',
    to,
    subject: '🎉 Your BigO license key',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto">

    <h1 style="font-size:24px;font-weight:700;margin-bottom:8px">BigO Pro activated 🎉</h1>
    <p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:32px">
      You're on the <strong style="color:#fff">${plan}${annual ? ' Annual' : ' Monthly'}</strong> plan.
      Unlimited solves, all AI providers.
    </p>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;margin-bottom:32px">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px">Your license key</p>
      <p style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#fff;letter-spacing:0.05em;margin:0">
        ${licenseKey}
      </p>
    </div>

    <div style="margin-bottom:32px">
      <p style="color:rgba(255,255,255,0.6);font-size:14px;font-weight:600;margin-bottom:12px">How to activate:</p>
      <ol style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.8;padding-left:20px;margin:0">
        <li>Open BigO on your Mac</li>
        <li>Press <strong style="color:rgba(255,255,255,0.6)">⌘,</strong> to open Settings</li>
        <li>Click <strong style="color:rgba(255,255,255,0.6)">License</strong> tab</li>
        <li>Paste your key and click Activate</li>
      </ol>
    </div>

    <a href="https://github.com/Atofinite5/BigO.space/releases/latest"
       style="display:inline-block;background:#fff;color:#000;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">
      Download BigO
    </a>

    <p style="color:rgba(255,255,255,0.2);font-size:12px;margin-top:32px">
      Works on up to 3 devices. Manage your license at
      <a href="https://bigo.space/dashboard" style="color:rgba(255,255,255,0.4)">bigo.space/dashboard</a>.
      Questions? Reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim(),
  })
}
