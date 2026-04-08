export const getWaitlistConfirmationEmailTemplate = (email: string) => {
  const subject = 'Welcome to the Brinn Waitlist';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Brinn Waitlist</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: linear-gradient(135deg, rgb(12, 62, 74) 0%, rgb(30, 80, 95) 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">Brinn</h1>
          <p style="color: rgb(245, 253, 255); margin: 8px 0 0 0; opacity: 0.9; font-weight: 400;">Sync Your Mind With Your Machine</p>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <h2 style="color: rgb(12, 62, 74); margin-top: 0; font-size: 24px; font-weight: 600;">You're on the List!</h2>
          
          <p style="color: #4b5563; font-size: 16px;">Thank you for joining the Brinn waitlist. You're now part of an exclusive group of early adopters who will be among the first to experience revolutionary context synchronization.</p>
          
          <div style="background: rgb(240, 252, 255); border-left: 4px solid rgb(12, 62, 74); padding: 20px; border-radius: 6px; margin: 24px 0;">
            <p style="color: rgb(12, 62, 74); margin: 0; font-weight: 600;">What's Next?</p>
            <p style="color: #1f2937; margin: 8px 0 0 0; font-size: 14px;">We're working hard to prepare Brinn for launch. You'll receive an exclusive email when early access becomes available. Keep an eye on your inbox!</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">In the meantime, check out our blog and documentation to learn more about how Brinn will transform the way you capture and organize your thoughts.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://brinn.app" style="display: inline-block; padding: 12px 32px; background: rgb(12, 62, 74); color: rgb(245, 253, 255); text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Learn More About Brinn</a>
          </div>
          
          <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              Best regards,<br>
              <strong>The Brinn Team</strong>
            </p>
            <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0 0;">
              You received this email because you signed up for the Brinn waitlist at <strong>${email}</strong>. If you did not sign up, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Welcome to Brinn!

Thank you for joining the Brinn waitlist. You're now part of an exclusive group of early adopters who will be among the first to experience revolutionary context synchronization.

What's Next?
We're working hard to prepare Brinn for launch. You'll receive an exclusive email when early access becomes available. Keep an eye on your inbox!

In the meantime, check out our blog and documentation to learn more about how Brinn will transform the way you capture and organize your thoughts.

Learn more: https://brinn.app

Best regards,
The Brinn Team

---
You received this email because you signed up for the Brinn waitlist at ${email}.
  `;

  return { subject, html, text };
};

export const getWaitlistAdminEmailTemplate = (email: string) => {
  const subject = `New Brinn Waitlist Signup: ${email}`;
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Waitlist Signup</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: linear-gradient(135deg, rgb(12, 62, 74) 0%, rgb(30, 80, 95) 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Brinn Admin</h1>
          <p style="color: rgb(245, 253, 255); margin: 8px 0 0 0; opacity: 0.8;">Waitlist Alert</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <h2 style="color: rgb(12, 62, 74); margin-top: 0; font-size: 20px; font-weight: 600;">New Waitlist Signup</h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <p style="color: #1f2937; margin: 0;"><strong>Email:</strong></p>
            <p style="color: rgb(12, 62, 74); margin: 4px 0 0 0; font-size: 18px; font-weight: 600; font-family: monospace;">${email}</p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0;">
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Timestamp</p>
              <p style="color: #1f2937; margin: 4px 0 0 0;">${new Date().toLocaleString()}</p>
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Source</p>
              <p style="color: #1f2937; margin: 4px 0 0 0;">Landing Page</p>
            </div>
          </div>
          
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <a href="https://admin.brinn.app/waitlist" style="display: inline-block; padding: 10px 20px; background: rgb(12, 62, 74); color: rgb(245, 253, 255); text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">View Waitlist</a>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
New Waitlist Signup

Email: ${email}
Timestamp: ${new Date().toLocaleString()}
Source: Landing Page

View all signups at: https://admin.brinn.app/waitlist
  `;

  return { subject, html, text };
};
