package com.algoarena.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class BrevoEmailService implements EmailService {

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    @Value("${brevo.api-key:}")
    private String brevoApiKey;

    @Value("${brevo.sender.email:no-reply@algoarena.com}")
    private String senderEmail;

    @Value("${brevo.sender.name:AlgoArena}")
    private String senderName;

    private final RestTemplate restTemplate;

    public BrevoEmailService() {
        this.restTemplate = new RestTemplate();
    }

    @Override
    public void sendPasswordResetEmail(String recipientEmail, String recipientName, String resetUrl) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            log.warn("[BrevoEmailService] BREVO_API_KEY is not configured. Reset link for {}: {}", recipientEmail, resetUrl);
            return;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
            headers.set("api-key", brevoApiKey.trim());

            Map<String, Object> body = new HashMap<>();
            
            // Sender
            Map<String, String> sender = new HashMap<>();
            sender.put("name", senderName);
            sender.put("email", senderEmail);
            body.put("sender", sender);

            // Recipient
            Map<String, String> to = new HashMap<>();
            to.put("email", recipientEmail);
            if (recipientName != null && !recipientName.isBlank()) {
                to.put("name", recipientName);
            }
            body.put("to", List.of(to));

            // Subject & Content
            body.put("subject", "Reset Your AlgoArena Password");
            body.put("htmlContent", buildHtmlTemplate(recipientName, resetUrl));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(BREVO_API_URL, entity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[BrevoEmailService] Password reset email sent successfully via REST API to: {}", recipientEmail);
            } else {
                log.error("[BrevoEmailService] Failed to send email via Brevo REST API. Status: {}, Response: {}", 
                        response.getStatusCode(), response.getBody());
            }
        } catch (Exception e) {
            log.error("[BrevoEmailService] Exception while sending email via Brevo REST API to {}: {}", recipientEmail, e.getMessage(), e);
        }
    }

    private String buildHtmlTemplate(String recipientName, String resetUrl) {
        String name = (recipientName != null && !recipientName.isBlank()) ? recipientName : "AlgoArena User";
        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Reset Your Password</title>
              <style>
                body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                .container { max-width: 540px; margin: 40px auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .header { background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 32px 24px; text-align: center; color: #FFFFFF; }
                .content { padding: 32px 28px; color: #334155; line-height: 1.6; }
                .btn { display: inline-block; background-color: #2563eb; color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3); }
                .footer { padding: 20px 28px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center; }
                .note { background-color: #EEF2FF; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #1e40af; margin: 16px 0; }
                .url-box { word-break: break-all; font-size: 12px; color: #64748B; background: #F1F5F9; padding: 10px; border-radius: 6px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">Algo<span style="color: #93C5FD;">Arena</span></h1>
                  <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
                </div>
                <div class="content">
                  <p style="font-size: 16px; font-weight: 600; color: #0F172A; margin-top: 0;">Hello %s,</p>
                  <p>We received a request to reset the password for your AlgoArena account.</p>
                  <p>Click the button below to choose a new password. This link is valid for <strong>15 minutes</strong>.</p>
                  <div style="text-align: center;">
                    <a href="%s" class="btn" target="_blank">Reset Password &rarr;</a>
                  </div>
                  <div class="note">
                    <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. Your password will remain unchanged and your account is safe.
                  </div>
                  <p style="font-size: 13px; color: #64748B; margin-top: 24px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  <div class="url-box">%s</div>
                </div>
                <div class="footer">
                  &copy; 2026 AlgoArena. Brain-Training & Algorithmic Arena Platform.<br>
                  This is an automated message, please do not reply.
                </div>
              </div>
            </body>
            </html>
            """.formatted(name, resetUrl, resetUrl);
    }
}
