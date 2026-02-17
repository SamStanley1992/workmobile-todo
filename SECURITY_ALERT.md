# 🔐 Security Alert - API Key Exposure Response

## ✅ Completed Automatically

The following changes have been made to secure your Firebase configuration:

1. ✅ Created `.env` file with environment variables
2. ✅ Created `.env.example` template for version control
3. ✅ Updated `.gitignore` to exclude `.env` files
4. ✅ Updated Firebase config to use environment variables instead of hardcoded values

## ⚠️ CRITICAL - Manual Steps Required

### Step 1: Regenerate Your API Key (URGENT)

The exposed API key **MUST** be regenerated immediately:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project `Sam2` (ID: sam2-76636)
3. Search for **"Credentials"** in the search bar
4. Find the API key: `AIzaSyAXzx4b9CWPkcukJP6JydG_fFimPNGTOoE`
5. Click **Edit** → **Regenerate Key**
6. Copy the new API key
7. Update your `.env` file with the new key:
   ```
   VITE_FIREBASE_API_KEY=your-new-regenerated-key-here
   ```

### Step 2: Add API Key Restrictions

To prevent future abuse:

1. In the Credentials page, edit your API key
2. Under **Application restrictions**, choose:
   - **HTTP referrers** for web apps
   - Add your domain (e.g., `*.yourdomain.com/*`)
3. Under **API restrictions**, select:
   - **Restrict key** and choose only the APIs you need (Firebase, etc.)
4. Click **Save**

### Step 3: Remove Key from Git History

The exposed key is still in your Git history. You need to remove it:

**Option A: Using git filter-repo (Recommended)**
```bash
# Install git-filter-repo first
pip install git-filter-repo

# Remove the file from history
git filter-repo --path assets/index-CVH7qlbH.js --invert-paths

# Force push
git push origin --force --all
```

**Option B: Using BFG Repo-Cleaner**
```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
# Replace the exposed key in all commits
bfg --replace-text <(echo "AIzaSyAXzx4b9CWPkcukJP6JydG_fFimPNGTOoE")

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

**Option C: Simplest - Delete and Re-create Repository**
If this is a new project with minimal history:
1. Delete the GitHub repository
2. Create a new repository
3. Push your updated code with the new configuration

### Step 4: Verify .env is Not Committed

Before committing:
```bash
git status
```

Ensure `.env` is **NOT** listed. Only `.env.example` should be tracked.

### Step 5: Review Billing and Usage

1. Check [Google Cloud Console Billing](https://console.cloud.google.com/billing)
2. Review API usage for any unexpected activity
3. Set up billing alerts to catch unusual usage

### Step 6: Update Your Build/Deploy Process

If you're deploying to hosting services (Vercel, Netlify, etc.):

1. Add environment variables in your hosting platform's settings
2. Do **NOT** commit the `.env` file
3. Use the platform's environment variable management

### Step 7: Test Locally

```bash
npm run dev
```

Verify your app still works with the environment variables.

## 📝 Best Practices Going Forward

1. **Never commit** `.env` files
2. **Always use** environment variables for secrets
3. **Add restrictions** to all API keys
4. **Monitor** your billing and API usage regularly
5. **Use** `.env.example` to document required variables
6. **Enable** Firebase App Check for additional security

## 🔍 GitHub Repository Issue

Your exposed key was found at:
- Repository: https://github.com/SamStanley1992/workmobile-todo
- File: `assets/index-CVH7qlbH.js` (build artifact)
- Commit: `5aa7a600866a731b73371b5ef0b7ee84b0b086b2`

**Important**: Make sure your `dist/` and build artifacts are in `.gitignore` (they already are) to prevent future exposure.

## ❓ Need Help?

If you have questions or need assistance:
1. Review [Firebase Security Best Practices](https://firebase.google.com/docs/projects/api-keys)
2. Check [Google Cloud API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
3. Contact Google Cloud Support if you suspect unauthorized usage

---

**Status**: Configuration updated. Awaiting manual API key regeneration and Git history cleanup.
