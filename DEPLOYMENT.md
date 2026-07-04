# Deployment Guide

## SecureExam - Deploying to Render or Other Platforms

This application has been migrated from Replit Auth to portable JWT-based authentication, allowing it to run on any platform including Render, Heroku, Railway, etc.


## Required Environment Variables

For production deployment, you **MUST** set the following environment variables:

### 1. JWT Secret
```
JWT_SECRET=your-very-long-random-secret-key-here
```
Generate a strong random secret (at least 32 characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Admin Credentials
```
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD_HASH=bcrypt-hash-of-your-password
```

To generate the password hash:
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-secure-password', 10).then(hash => console.log(hash))"
```

### 3. Database
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### 4. Node Environment
```
NODE_ENV=production
PORT=5000
```

### 5. OpenAI API Key (Optional - only if using AI verification)
```
OPENAI_API_KEY=your-openai-api-key
```

## Render Deployment Steps

1. **Create a new Web Service** on Render
2. **Connect your Git repository**
3. **Configure the service:**
   - **Build Command**: `npm install && npm run db:push`
   - **Start Command**: `npm start`
4. **Add all required environment variables** in the Render dashboard
5. **Create a PostgreSQL database** (if not using external database)
6. **Deploy!**

## Security Notes

⚠️ **IMPORTANT**: The demo credentials file (`server/admin-credentials.json`) is ONLY for local development. In production, the application will ONLY accept credentials from environment variables and will fail to start if they are not provided. This prevents accidentally deploying with insecure demo credentials.

## Demo Credentials (Development Only)

For local development, you can use:
- Email: `admin@secureexam.com`
- Password: `admin123`

**Never use these credentials in production!**

## Testing the Deployment

After deployment:
1. Visit your app URL
2. Click "Admin" to go to `/admin/login`
3. Login with your production admin credentials
4. Verify all features work correctly

## Troubleshooting

### "PRODUCTION SECURITY" Error
This means you haven't set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` environment variables. Set them in your hosting platform's dashboard.

### "JWT_SECRET environment variable is required"
Set the `JWT_SECRET` environment variable with a strong random value.

### Students can't login
Students use hall tickets, not admin authentication. Make sure the admin can create hall tickets first, then students can authenticate using QR codes or hall ticket IDs.
