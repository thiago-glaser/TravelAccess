---
description: Password Reset Workflow Implementation
---

# Forgot Password Workflow

This workflow enables users to reset their forgotten passwords through a secure token-based process.

## Setup

1. **Database Migration**: Add necessary columns to the `USERS` table.
   ```sql
   ALTER TABLE USERS ADD (
       RESET_PASSWORD_TOKEN VARCHAR2(128),
       RESET_PASSWORD_EXPIRES TIMESTAMP
   );
   ```

2. **Model Update**: Ensure `lib/models/User.js` includes the new fields:
   - `resetPasswordToken`
   - `resetPasswordExpires`

## Components

### 1. Forgot Password Page (`/forgot-password`)
- Request user's email address.
- Call API to generate and store a reset token.
- Display success message (even if user doesn't exist for security).

### 2. Reset Password Page (`/reset-password/[token]`)
- Validate token and expiration.
- Collect and confirm new password.
- Call API to update password and clear reset fields.

## API Endpoints

### 1. Request Reset (`POST /api/auth/forgot-password`)
- Find user by email.
- Generate secure random token (using `crypto`).
- Store token and expiry (1 hour) in DB.
- Log/Send reset link: `[BASE_URL]/reset-password/[TOKEN]`.

### 2. Perform Reset (`POST /api/auth/reset-password`)
- Verify token and check if it hasn't expired.
- Hash new password using `bcrypt`.
- Update user record and nullify reset fields.

## Security Considerations
- **Generic Success Messages**: Don't confirm if an email exists in the DB on the forgot-password page.
- **Token Expiration**: Tokens should have a short lifespan (e.g., 1 hour).
- **One-time Use**: Clear the token after a successful reset.
- **Secure Hashing**: Always hash passwords using `bcrypt` or similar.
