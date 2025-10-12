const nodemailer = require('nodemailer');

// Create email transporter with better error handling
const createTransporter = () => {
  // Debug environment variables (remove in production)
  console.log('🔍 Email Configuration Check:');
  console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'Not set');
  console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'Not set');
  console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not set');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'Not set');

  const transportConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    // Additional debugging
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  };

  // Check if credentials are available
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ EMAIL_USER or EMAIL_PASS environment variables not set!');
    throw new Error('Email credentials not configured');
  }

  // FIX: Use createTransport instead of createTransporter
  return nodemailer.createTransport(transportConfig);
};

// Email templates (keeping your existing templates)
const emailTemplates = {
  emailVerification: (data) => ({
    subject: 'Verify Your Email - Journal Platform',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
              .header p { font-size: 16px; opacity: 0.9; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
              .message { font-size: 16px; margin-bottom: 30px; color: #4b5563; line-height: 1.8; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; margin: 10px 0; }
              .cta-button:hover { transform: translateY(-2px); }
              .alternative-link { margin-top: 25px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6; }
              .alternative-link p { margin-bottom: 10px; font-size: 14px; color: #6b7280; }
              .alternative-link a { color: #3b82f6; word-break: break-all; text-decoration: none; }
              .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; font-size: 14px; margin-bottom: 5px; }
              .security-note { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .security-note p { color: #92400e; font-size: 14px; margin: 0; }
              @media (max-width: 600px) { .container { margin: 10px; } .header, .content, .footer { padding: 20px; } }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>📚 Journal Platform</h1>
                  <p>Academic Publishing Made Simple</p>
              </div>
              <div class="content">
                  <div class="greeting">Hello ${data.fullName},</div>
                  <div class="message">
                      Welcome to Journal Platform! We're excited to have you join our community of researchers, publishers, and reviewers.
                      <br><br>
                      To get started and secure your account, please verify your email address by clicking the button below:
                  </div>
                  <div style="text-align: center;">
                      <a href="${data.verificationUrl}" class="cta-button">Verify My Email</a>
                  </div>
                  <div class="alternative-link">
                      <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                      <a href="${data.verificationUrl}">${data.verificationUrl}</a>
                  </div>
                  <div class="security-note">
                      <p><strong>⚠️ Security Note:</strong> This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
                  </div>
              </div>
              <div class="footer">
                  <p><strong>Journal Platform</strong></p>
                  <p>Connecting researchers worldwide</p>
                  <p style="margin-top: 15px;">If you have any questions, feel free to contact our support team.</p>
              </div>
          </div>
      </body>
      </html>
    `
  }),

  passwordReset: (data) => ({
    subject: '🔒 Password Reset Request - Journal Platform',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
              .message { font-size: 16px; margin-bottom: 30px; color: #4b5563; line-height: 1.8; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; margin: 10px 0; }
              .cta-button:hover { transform: translateY(-2px); }
              .alternative-link { margin-top: 25px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #f59e0b; }
              .alternative-link p { margin-bottom: 10px; font-size: 14px; color: #6b7280; }
              .alternative-link a { color: #f59e0b; word-break: break-all; text-decoration: none; }
              .security-warning { background-color: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .security-warning p { color: #991b1b; font-size: 14px; margin: 0; }
              .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; font-size: 14px; }
              @media (max-width: 600px) { .container { margin: 10px; } .header, .content, .footer { padding: 20px; } }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔒 Password Reset</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hello ${data.fullName},</div>
                  <div class="message">
                      We received a request to reset the password for your Journal Platform account.
                      <br><br>
                      If you made this request, click the button below to set a new password:
                  </div>
                  <div style="text-align: center;">
                      <a href="${data.resetUrl}" class="cta-button">Reset My Password</a>
                  </div>
                  <div class="alternative-link">
                      <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                      <a href="${data.resetUrl}">${data.resetUrl}</a>
                  </div>
                  <div class="security-warning">
                      <p><strong>⚠️ Important Security Information:</strong></p>
                      <p>• This reset link will expire in 1 hour for security purposes</p>
                      <p>• If you didn't request this password reset, please ignore this email</p>
                      <p>• Your current password will remain unchanged until you create a new one</p>
                  </div>
              </div>
              <div class="footer">
                  <p><strong>Journal Platform Security Team</strong></p>
                  <p>If you have security concerns, please contact us immediately.</p>
              </div>
          </div>
      </body>
      </html>
    `
  }),

  welcome: (data) => ({
    subject: '🎉 Welcome to Journal Platform!',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Journal Platform</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
              .message { font-size: 16px; margin-bottom: 25px; color: #4b5563; line-height: 1.8; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; margin: 20px 0; }
              .cta-button:hover { transform: translateY(-2px); }
              .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; font-size: 14px; }
              @media (max-width: 600px) { .container { margin: 10px; } .header, .content, .footer { padding: 20px; } }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎉 Welcome Aboard!</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hello ${data.fullName},</div>
                  <div class="message">
                      Congratulations! Your email has been successfully verified and your Journal Platform account is now active.
                      <br><br>
                      You're now part of a vibrant community dedicated to advancing academic research and knowledge sharing.
                  </div>
                  <div style="text-align: center;">
                      <a href="${data.loginUrl}" class="cta-button">Start Your Journey</a>
                  </div>
              </div>
              <div class="footer">
                  <p><strong>Journal Platform Team</strong></p>
                  <p>We're here to support your research journey every step of the way!</p>
              </div>
          </div>
      </body>
      </html>
    `
  }),

  passwordChanged: (data) => ({
    subject: '✅ Password Changed Successfully - Journal Platform',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
              .message { font-size: 16px; margin-bottom: 30px; color: #4b5563; line-height: 1.8; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; margin: 10px 0; }
              .cta-button:hover { transform: translateY(-2px); }
              .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; font-size: 14px; }
              @media (max-width: 600px) { .container { margin: 10px; } .header, .content, .footer { padding: 20px; } }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>✅ Password Updated!</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hello ${data.fullName},</div>
                  <div class="message">
                      Great news! Your password has been successfully updated for your Journal Platform account.
                      <br><br>
                      Your account is now secured with your new password. You can log in anytime using your new credentials.
                  </div>
                  <div style="text-align: center;">
                      <a href="${data.loginUrl}" class="cta-button">Login to Your Account</a>
                  </div>
              </div>
              <div class="footer">
                  <p><strong>Journal Platform Security Team</strong></p>
                  <p>Your account security is our top priority.</p>
              </div>
          </div>
      </body>
      </html>
    `
  }),

  loginWelcome: (data) => ({
    subject: '👋 Welcome Back to Journal Platform!',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome Back</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
              .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { font-size: 28px; margin-bottom: 8px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .greeting { font-size: 18px; margin-bottom: 20px; color: #1f2937; }
              .message { font-size: 16px; margin-bottom: 25px; color: #4b5563; line-height: 1.8; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s; margin: 20px 0; }
              .cta-button:hover { transform: translateY(-2px); }
              .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #6b7280; font-size: 14px; }
              @media (max-width: 600px) { .container { margin: 10px; } .header, .content, .footer { padding: 20px; } }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>👋 Welcome Back!</h1>
              </div>
              <div class="content">
                  <div class="greeting">Hello ${data.fullName},</div>
                  <div class="message">
                      Great to see you again! You've successfully logged into your Journal Platform account.
                      <br><br>
                      Ready to continue your research journey?
                  </div>
                  <div style="text-align: center;">
                      <a href="${data.dashboardUrl}" class="cta-button">Go to Dashboard</a>
                  </div>
              </div>
              <div class="footer">
                  <p><strong>Journal Platform Team</strong></p>
                  <p>Continue making great discoveries!</p>
              </div>
          </div>
      </body>
      </html>
    `
  })
};

// Main send email function with enhanced error handling
const sendEmail = async ({ to, subject, template, data }) => {
  try {
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Template: ${template}`);
    
    const transporter = createTransporter();
    
    // Test connection first
    console.log('🔄 Testing email connection...');
    await transporter.verify();
    console.log('✅ Email connection verified successfully');
    
    // Get template
    const emailTemplate = emailTemplates[template];
    if (!emailTemplate) {
      throw new Error(`Email template '${template}' not found`);
    }

    const templateData = emailTemplate(data);

    const mailOptions = {
      from: {
        name: 'Journal Platform',
        address: process.env.EMAIL_USER
      },
      to: to,
      subject: templateData.subject,
      html: templateData.html,
      // Add headers to improve deliverability
      headers: {
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'X-Mailer': 'Journal Platform',
        'X-MimeOLE': 'Produced By Journal Platform'
      }
    };

    console.log('🚀 Sending email...');
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', {
      to: to,
      subject: templateData.subject,
      messageId: info.messageId,
      template: template,
      response: info.response
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    
    // More detailed error logging
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.response) {
      console.error('SMTP Response:', error.response);
    }
    if (error.responseCode) {
      console.error('Response Code:', error.responseCode);
    }
    
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Test email connection with more detailed feedback
const testEmailConnection = async () => {
  try {
    console.log('🔍 Testing email service configuration...');
    
    // Check environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Missing EMAIL_USER or EMAIL_PASS environment variables');
      return false;
    }
    
    const transporter = createTransporter();
    console.log('🔄 Verifying SMTP connection...');
    
    await transporter.verify();
    console.log('✅ Email service is ready and working!');
    return true;
    
  } catch (error) {
    console.error('❌ Email service connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    // Provide helpful suggestions based on error
    if (error.code === 'EAUTH') {
      console.error('🔧 Suggestion: Check your email credentials (EMAIL_USER and EMAIL_PASS)');
      console.error('🔧 For Gmail: Make sure you\'re using App Password, not regular password');
    } else if (error.code === 'ECONNECTION') {
      console.error('🔧 Suggestion: Check your internet connection and SMTP settings');
    } else if (error.code === 'ESOCKET') {
      console.error('🔧 Suggestion: Check firewall settings or try different SMTP port');
    }
    
    return false;
  }
};

module.exports = {
  sendEmail,
  testEmailConnection
};