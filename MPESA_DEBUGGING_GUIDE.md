# M-Pesa STK Push - Debugging Guide

## Quick Diagnosis

Your app encountered: **"Invalid response from M-Pesa API" and "Missing CheckoutRequestID"**

This means the API call to `mpesa_stk_initiate` is failing. Follow the steps below to identify the root cause.

---

## Step 1: Verify M-Pesa Credentials

The most common cause of this error is **missing or incomplete M-Pesa credentials**.

### Option A: Check via Admin Dashboard

1. Log in to your app as an admin
2. Navigate to **Settings → M-Pesa Configuration**
3. Verify all fields are filled:
   - **Consumer Key** ✅
   - **Consumer Secret** ✅
   - **Business Shortcode** ✅
   - **Passkey** ✅
   - **Environment** (sandbox or production) ✅
   - **Callback URLs** (C2B and B2C) ✅

### Option B: Check via Verification Script

1. **Access the verification script:**
   ```
   https://your-domain.com/verify_mpesa_settings.php
   ```

2. **Review the JSON output:**
   - ✅ **"status": "VALID"** → Credentials are properly saved
   - ⚠️ **"status": "INCOMPLETE"** → Some fields are missing
   - ❌ **"status": "NOT FOUND"** → No credentials saved

3. **If credentials are missing:**
   - Go to Admin Dashboard → M-Pesa Settings
   - Fill in all required fields
   - Save and come back to this verification script to confirm

---

## Step 2: Test M-Pesa API Connectivity

Run the comprehensive API test:

### Using the Test Endpoint

1. **Just check credentials (safest):**
   ```bash
   curl -X POST https://your-domain.com/test_mpesa_api.php \
     -H "Content-Type: application/json" \
     -d '{"test": "credentials"}'
   ```

2. **Test full STK push flow:**
   ```bash
   curl -X POST https://your-domain.com/test_mpesa_api.php \
     -H "Content-Type: application/json" \
     -d '{
       "test": "stk_push",
       "phone": "254722241745",
       "amount": 100
     }'
   ```

3. **Expected successful response:**
   ```json
   {
     "success": true,
     "status": "✅ All tests passed",
     "steps": [
       {
         "name": "Loading dependencies",
         "status": "✅ success"
       },
       {
         "name": "Loading M-Pesa credentials",
         "status": "✅ success",
         "details": {
           "source": "admin_settings",
           "environment": "production",
           "has_consumer_key": true,
           "has_consumer_secret": true,
           "has_shortcode": true,
           "has_passkey": true
         }
       },
       {
         "name": "Retrieving M-Pesa access token",
         "status": "✅ success"
       }
     ]
   }
   ```

---

## Step 3: Check Server Logs

Enhanced logging has been added to track issues:

### Option A: Check Error Logs

1. **SSH into your server:**
   ```bash
   ssh user@your-domain.com
   ```

2. **Check PHP error log:**
   ```bash
   tail -100 /path/to/php/error_log
   ```

3. **Look for lines starting with:**
   - `[MPESA STK INITIATE]` - Detailed request logs
   - `[MPESA STK INITIATE ERROR]` - Error details
   - `[MPESA CREDS]` - Credential loading info
   - `[MPESA TOKEN REQUEST]` - Token generation logs

### Option B: Check Browser Console

1. Open **Browser DevTools** (F12)
2. Go to **Console** tab
3. Try to make a payment
4. Look for messages like:
   - `[API] mpesa_stk_initiate` - Shows the API request
   - `[API] mpesa_stk_initiate failed with primary URL:` - Error details

### Option C: Check Network Tab

1. Open **Browser DevTools** (F12)
2. Go to **Network** tab
3. Try to make a payment
4. Look for `api.php` request
5. Click on it and view the **Response** tab
6. Should show:
   ```json
   {
     "status": "success",
     "message": "STK push initiated successfully.",
     "data": {
       "checkout_request_id": "ws_CO_...",
       "merchant_request_id": "...",
       "response_code": "0",
       "response_description": "..."
     }
   }
   ```

---

## Step 4: Common Issues and Solutions

### Issue 1: "M-Pesa credentials not configured"

**Cause:** Credentials are not saved in the database.

**Fix:**
1. Go to Admin Dashboard → M-Pesa Settings
2. Fill in all required fields exactly as they appear in Daraja portal
3. Click "Save" and verify you see a success message
4. Run the verification script again

### Issue 2: "M-Pesa credentials incomplete"

**Cause:** Some credential fields are empty.

**Fix:**
1. Check each field in Admin Dashboard
2. Ensure no field is left blank
3. Verify the **Environment** is set to correct value (sandbox/production)
4. Re-save the settings

### Issue 3: "Failed to obtain M-Pesa access token"

**Cause:** 
- Invalid Consumer Key or Consumer Secret
- Network connectivity issues
- M-Pesa API is down

**Fix:**
1. Verify credentials in Daraja portal are correct
2. Check server can reach `api.safaricom.co.ke` (firewall/proxy issue)
3. Test command:
   ```bash
   curl -I https://api.safaricom.co.ke
   ```

### Issue 4: "Invalid response from M-Pesa API"

**Cause:** M-Pesa API returned invalid/empty response.

**Possible Fixes:**
1. Check server time is synchronized:
   ```bash
   date  # Should show current time
   ```
2. Verify firewall allows outbound HTTPS to `api.safaricom.co.ke`
3. Contact M-Pesa support to confirm your account is activated
4. Try with sandbox environment first if using production

### Issue 5: "STK push initiated but customer doesn't receive prompt"

**Cause:** Callback URL may not be registered or valid.

**Fix:**
1. Log into **Daraja Portal**
2. Go to **URL Management**
3. Verify both URLs are registered:
   - **Validation URL:** `https://your-domain.com/c2b_callback.php`
   - **Confirmation URL:** `https://your-domain.com/c2b_callback.php`
4. Both should show "Completed" status
5. Click "Test Callback" to validate the URL is accessible

---

## Step 5: Check Callback URL Registration

The callback URL must be registered in the Daraja portal:

1. **Log into Daraja:** https://developer.safaricom.co.ke
2. **Navigate to:** Live Environment → App Details → URL Management
3. **Register these URLs:**
   - **Validation URL:** `https://your-domain.com/c2b_callback.php`
   - **Confirmation URL:** `https://your-domain.com/c2b_callback.php`
   - **Response Type:** JSON (not XML)

4. **Test the URL:**
   - Click "Test" button next to the URL
   - Should show "Test Status: Successful"

---

## Step 6: Monitor Callback Logs

Once STK push is initiated, M-Pesa will call your callback URL:

### Check Callback Logs

1. **SSH into server:**
   ```bash
   ssh user@your-domain.com
   ```

2. **View callback logs:**
   ```bash
   tail -50 c2b_callbacks.log
   ```

3. **Look for entries like:**
   ```
   {"timestamp":"2026-02-12 12:49:16","event_type":"c2b_received",...}
   {"timestamp":"2026-02-12 12:49:16","event_type":"c2b_session_updated",...}
   {"timestamp":"2026-02-12 12:49:16","event_type":"c2b_payment_successful",...}
   ```

---

## Step 7: Enable Maximum Debug Logging

For detailed diagnosis, temporarily enable debug output:

1. **Edit api.php** (line ~11):
   ```php
   ini_set('display_errors', '1');  // Change from '0' to '1'
   ```

2. **Restart PHP/Apache:**
   ```bash
   sudo systemctl restart apache2
   # or
   sudo systemctl restart php7.4-fpm  # adjust version
   ```

3. **Try payment again and check logs**

4. **Remember to revert after debugging:**
   ```php
   ini_set('display_errors', '0');  // Change back
   ```

---

## Checklist

Before contacting support, verify:

- [ ] M-Pesa credentials are filled in Admin Dashboard
- [ ] Credentials verification script shows "VALID" status
- [ ] API test endpoint shows all steps as "✅ success"
- [ ] Callback URLs are registered in Daraja portal
- [ ] Callback URL test shows "Successful"
- [ ] Server time is synchronized (check with `date` command)
- [ ] Firewall allows HTTPS to api.safaricom.co.ke
- [ ] You're using the correct environment (sandbox vs production)

---

## Log File Locations

- **PHP Error Log:** `/var/log/php-fpm.log` or `/var/log/apache2/error.log`
- **M-Pesa Request Logs:** Check PHP error_log (contains [MPESA] prefixed entries)
- **Callback Logs:** `c2b_callbacks.log` (in your app root)
- **API Event Logs:** `api_events.log` (in your app root)
- **Raw Callback Data:** `mpesa_callback_raw.txt` (for debugging callback format)

---

## Need Help?

1. Run the **test_mpesa_api.php** script and share the JSON response
2. Share relevant logs from the checklist above (mask sensitive data)
3. Verify the checklist items above first
4. Contact M-Pesa support if token retrieval fails

---

## Key Files Modified

- **api.php** - Enhanced error logging in `mpesa_stk_initiate` handler
- **verify_mpesa_settings.php** - Improved credential verification
- **test_mpesa_api.php** - New comprehensive API test endpoint (NEW)
- **mpesa_helper.php** - No changes (working correctly)
- **c2b_callback.php** - No changes (working correctly)
