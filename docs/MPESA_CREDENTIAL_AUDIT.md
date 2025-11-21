# M-Pesa Credential Handling Audit Report

**Date**: 2024  
**Scope**: Trainer Coach Connect payment system  
**Focus**: Credential management and admin settings integration

---

## Executive Summary

**🔴 CRITICAL FINDINGS**: The M-Pesa credential system has significant architectural issues:

1. **Development-only credential handling** - Credentials are only processed in Vite dev server, not production
2. **No actual M-Pesa API integration in production** - api.php returns simulated responses instead of calling M-Pesa
3. **Credentials passed client-side** - Frontend sends credentials in request body instead of using server-only auth
4. **Admin settings not integrated with production API** - PHP backend doesn't fetch or use admin-configured credentials
5. **Inconsistent credential sources** - Falls back to env vars, not enforcing admin settings as source of truth

---

## Credential Flow Architecture

### Current Implementation

```
Frontend (React)
  ↓
loadSettings() → localStorage → settings.mpesa
  ↓
Request Body: { mpesa_creds: settings.mpesa, ... }
  ↓
  ├─ DEV MODE:
  │   └→ Vite Middleware (/payments/mpesa/*)
  │       ├→ Check body.mpesa_creds
  │       ├→ Fallback: process.env.MPESA_*
  │       └→ Call M-Pesa Daraja API ✓
  │
  └─ PRODUCTION MODE:
      └→ PHP api.php (stk_push_initiate, etc.)
          ├→ Ignores credentials
          └→ Returns mock responses ✗
```

### Issues Identified

#### 1. **Frontend Credential Exposure**
- **Location**: `src/components/client/ClientPaymentForm.tsx:120-124`, `WalletManager.tsx:97-101`
- **Issue**: Credentials loaded from localStorage and sent in request body
- **Risk**: Credentials visible in network requests, logs, browser history
- **Code Example**:
  ```typescript
  const settings = loadSettings()
  const response = await fetch('/payments/mpesa/stk-initiate', {
    body: JSON.stringify({
      phone: phoneNum,
      amount: amount,
      mpesa_creds: settings.mpesa  // ⚠️ Credentials in request body
    })
  })
  ```

#### 2. **Development-Only Integration**
- **Location**: `vite.config.ts:112-208` (paymentsApiPlugin)
- **Issue**: M-Pesa API calls only in Vite dev server middleware
- **Details**:
  - Gets credentials from request body or env vars
  - Makes actual calls to M-Pesa Daraja API
  - Only runs when `mode === 'development'`
- **Impact**: Production builds don't have this capability

#### 3. **Production API Stubbed Out**
- **Location**: `api.php:2266-2366` (stk_push_initiate case)
- **Issue**: Returns simulated responses instead of calling M-Pesa
- **Current Behavior**:
  ```php
  case 'stk_push_initiate':
      // ... validation ...
      // Simulate STK Push initiation (in production, integrate with M-Pesa Daraja API)
      // For testing, return a mock checkout ID
      $checkoutRequestId = 'WS_CO_' . uniqid();
      respond("success", "STK push initiated successfully.", [
          "CheckoutRequestID" => $checkoutRequestId,  // Mock ID, not from M-Pesa
      ]);
  ```
- **Impact**: Real M-Pesa transactions not initiated

#### 4. **Admin Settings Not Enforced**
- **Location**: `src/lib/settings.ts`
- **Issue**: M-Pesa settings are in localStorage, but production API doesn't use them
- **Config Structure**:
  ```typescript
  export type MpesaSettings = {
    environment: 'sandbox' | 'production'
    consumerKey: string
    consumerSecret: string
    passkey: string
    initiatorName: string
    securityCredential: string
    shortcode: string
    resultUrl: string
    // ...
  }
  ```
- **Problem**: These settings only used in dev mode, not enforced in production

#### 5. **Inconsistent Credential Sources**
- **Vite Config** (`vite.config.ts:131-137`):
  ```typescript
  const creds = {
    consumer_key: clientCreds.consumerKey || process.env.MPESA_CONSUMER_KEY,
    consumer_secret: clientCreds.consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    // ... fallback to env vars
  };
  ```
- **Issue**: Falls back to environment variables instead of admin settings
- **Order of precedence** (wrong):
  1. Request body (client-side)
  2. Environment variables
  3. Admin settings (should be #1)

#### 6. **Missing B2C API Integration**
- **Location**: `api.php:2152-2205` (b2c_payment_initiate case)
- **Issue**: No actual M-Pesa B2C call
- **Current Code**:
  ```php
  case 'b2c_payment_initiate':
      // Prepare M-Pesa B2C API call (would be done via external service)
      // For now, just update status to "initiated"
      $updateStmt->execute();
      respond("success", "B2C payment initiated. Waiting for M-Pesa callback.", [
          // Returns without actual API call
      ]);
  ```

#### 7. **Callback Handlers Not Using Credentials**
- **Files**: `c2b_callback.php`, `clientpaymentcallback.php`
- **Note**: Callbacks don't require credentials (M-Pesa initiates)
- **Good**: No credential validation needed for receiving webhooks

---

## Settings Storage & Access

### Current Flow

#### 1. **Admin Settings Panel** (`AdminDashboard.tsx`)
- M-Pesa settings form accepts:
  - environment (sandbox/production)
  - consumerKey, consumerSecret
  - passkey, initiatorName, securityCredential
  - shortcode, resultUrl

#### 2. **Storage Methods**
- **Client-side**: localStorage via `saveSettings()`
- **Server-side**: Attempted via `saveSettingsToDb()` → `settings_save` API action
- **DB endpoint**: Mock implementation in `vite.config.ts:82-91`

#### 3. **Settings Retrieval**
- **Client**: `loadSettings()` → localStorage
- **Server**: `loadSettingsFromDb()` → attempts API call

#### 4. **Admin API Endpoints** (`vite.config.ts`)
- `/__admin/set-mpesa-credentials` (POST) - Mock implementation
- `/__admin/get-mpesa-credentials` (GET) - Mock implementation
- **Issue**: These are mock endpoints only, not production APIs

---

## Credential Validation Issues

### Missing Validation Points

| Point | Required? | Status | Issue |
|-------|-----------|--------|-------|
| Admin settings before payment | ✓ | Missing | No check if credentials configured |
| Credentials in payment API | ✓ | Partial | Only in Vite, not api.php |
| Server-side credential storage | ✓ | Missing | No actual DB storage |
| Credential encryption at rest | ✓ | Missing | Stored in plain localStorage |
| HTTPS enforcement for M-Pesa | ✓ | Partial | Only in docs, not enforced |
| Credential expiry handling | ✓ | Missing | No refresh logic |

### Validation Checks Present

✓ Phone number format validation  
✓ Amount range validation (10-150000)  
✓ Basic credential existence check (Vite only)  
✓ Callback JSON structure validation  

---

## Environment Variables vs Admin Settings

### Current Precedence (WRONG)

```
1. Request body (client-side) ← DANGEROUS
2. Environment variables     ← WORKS but not flexible
3. Admin settings            ← NOT USED IN PRODUCTION
```

### Correct Precedence (SHOULD BE)

```
1. Admin settings (server-side, enforced)   ← SECURE
2. Environment variables (fallback only)
3. Request body (NEVER, security risk)
```

### Environment Variables in Use

```bash
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_ENVIRONMENT=sandbox|production
MPESA_RESULT_URL=https://...
```

---

## API Endpoints Audit

### Development Mode (Vite)

| Endpoint | Method | Credentials | M-Pesa Call | Status |
|----------|--------|-------------|-------------|--------|
| `/payments/mpesa/stk-initiate` | POST | Body + Env | ✓ Real API | Works in dev |
| `/payments/mpesa/stk-query` | POST | Body + Env | ✓ Real API | Works in dev |
| `/__admin/set-mpesa-credentials` | POST | Token | Mock DB | Dev only |
| `/__admin/get-mpesa-credentials` | GET | Token | Mock DB | Dev only |

### Production Mode (PHP)

| Endpoint | Method | Credentials | M-Pesa Call | Status |
|----------|--------|-------------|-------------|--------|
| `api.php?action=stk_push_initiate` | POST | NONE | ✗ Mocked | Broken |
| `api.php?action=stk_push_query` | POST | NONE | ✗ Mocked | Broken |
| `api.php?action=b2c_payment_initiate` | POST | NONE | ✗ NOT IMPL | Broken |
| `c2b_callback.php` | POST | NONE | - | Works (receive only) |
| `clientpaymentcallback.php` | POST | NONE | - | Works (receive only) |

---

## Component Credential Usage

### ClientPaymentForm.tsx
```typescript
// Line 119-124
const settings = loadSettings()
const response = await fetch('/payments/mpesa/stk-initiate', {
  body: JSON.stringify({
    phone: phoneNum,
    amount: amount,
    mpesa_creds: settings.mpesa  // ← Passing credentials client-side
  })
})
```
**Issue**: Exposes credentials in network request

### WalletManager.tsx
```typescript
// Line 96-101
const response = await fetch('/payments/mpesa/stk-initiate', {
  body: JSON.stringify({
    phone: user?.phone || '',
    amount: amount,
    mpesa_creds: settings.mpesa  // ← Same issue
  })
})
```

### AdminDashboard.tsx
```typescript
// Lines 1880-1920 (MPesa Settings section)
const [mpesa, setMpesa] = useState<MpesaSettings>(defaultMpesaSettings)
// Form inputs for: environment, consumerKey, consumerSecret, passkey, etc.
// On save: saveSettings(settings) → localStorage only
```
**Issue**: Only saves to localStorage, not server/DB

---

## Security Concerns

### 1. **Client-Side Secret Exposure** 🔴 CRITICAL
- Credentials stored in localStorage (plaintext)
- Sent in request body (visible in logs, proxies)
- Could be extracted from browser via XSS

### 2. **No Credential Encryption** 🔴 CRITICAL
- Secrets stored unencrypted in localStorage
- No TLS encryption at rest
- Admin can see in browser console

### 3. **No Access Control** 🟡 HIGH
- Vite admin endpoints check token but mock implementation
- Production API ignores credentials entirely
- No role-based access to credential configuration

### 4. **No Audit Trail** 🟡 MEDIUM
- No logging of credential creation/updates
- Can't track who configured credentials when
- No credential rotation tracking

### 5. **No Secret Management** 🟡 MEDIUM
- Should use secrets manager (e.g., HashiCorp Vault)
- Instead: browser localStorage
- No expiry or rotation mechanism

---

## Recommended Fixes

### Priority 1: Server-Side Credential Management

**Issue**: Credentials are client-side and passed in requests

**Fix**: Implement server-side credential management
```php
// api.php - ADD THIS
case 'stk_push_initiate':
    // Retrieve credentials from server-side secure storage
    $mpesaSettings = getAdminSettings('mpesa');
    
    if (!$mpesaSettings || !$mpesaSettings['consumer_key']) {
        respond("error", "M-Pesa credentials not configured", null, 500);
        return;
    }
    
    $creds = [
        'consumer_key' => $mpesaSettings['consumer_key'],
        'consumer_secret' => $mpesaSettings['consumer_secret'],
        'shortcode' => $mpesaSettings['shortcode'],
        'passkey' => $mpesaSettings['passkey'],
        'environment' => $mpesaSettings['environment'] ?? 'sandbox'
    ];
    
    // Call M-Pesa API with server-side credentials
    $stkResult = callMpesaAPI($creds, $phone, $amount);
```

### Priority 2: Production API Integration

**Issue**: api.php returns mock responses instead of calling M-Pesa

**Fix**: Implement actual M-Pesa API calls in PHP
```php
function callMpesaAPI($creds, $phone, $amount) {
    $environment = $creds['environment'];
    
    $tokenUrl = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    
    $basic = base64_encode($creds['consumer_key'] . ':' . $creds['consumer_secret']);
    
    $tokenResponse = curlRequest($tokenUrl, ['Authorization: Basic ' . $basic]);
    $accessToken = json_decode($tokenResponse)->access_token;
    
    $stkUrl = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    
    // Build and send STK push request
    $timestamp = date('YmdHis');
    $password = base64_encode($creds['shortcode'] . $creds['passkey'] . $timestamp);
    
    $payload = [
        'BusinessShortCode' => $creds['shortcode'],
        'Password' => $password,
        'Timestamp' => $timestamp,
        'TransactionType' => 'CustomerPayBillOnline',
        'Amount' => intval($amount),
        'PartyA' => $phone,
        'PartyB' => $creds['shortcode'],
        'PhoneNumber' => $phone,
        'CallBackURL' => $creds['result_url'],
        'AccountReference' => 'OrderRef',
        'TransactionDesc' => 'Payment'
    ];
    
    $response = curlRequest(
        $stkUrl,
        ['Authorization: Bearer ' . $accessToken, 'Content-Type: application/json'],
        json_encode($payload),
        'POST'
    );
    
    return json_decode($response);
}
```

### Priority 3: Admin Settings as Source of Truth

**Issue**: Admin settings not enforced; env vars used instead

**Fix**: Enforce admin settings with env var fallback (not vice versa)
```php
function getAdminMpesaSettings() {
    // Try admin settings first
    $settings = getAdminSettings('mpesa');
    
    if ($settings && !empty($settings['consumer_key']) && !empty($settings['consumer_secret'])) {
        return $settings;
    }
    
    // Fallback to environment variables only if no admin config
    if (empty($settings)) {
        return [
            'consumer_key' => getenv('MPESA_CONSUMER_KEY'),
            'consumer_secret' => getenv('MPESA_CONSUMER_SECRET'),
            'shortcode' => getenv('MPESA_SHORTCODE'),
            'passkey' => getenv('MPESA_PASSKEY'),
            'environment' => getenv('MPESA_ENVIRONMENT') ?? 'sandbox',
            'result_url' => getenv('MPESA_RESULT_URL')
        ];
    }
    
    return null;
}
```

### Priority 4: Remove Client-Side Credential Passing

**Issue**: Frontend passes credentials in requests

**Fix**: Never pass credentials from frontend
```typescript
// BEFORE (ClientPaymentForm.tsx - BAD)
const response = await fetch('/payments/mpesa/stk-initiate', {
  body: JSON.stringify({
    phone: phoneNum,
    amount: amount,
    mpesa_creds: settings.mpesa  // ❌ REMOVE THIS
  })
})

// AFTER (GOOD)
const response = await fetch('/payments/mpesa/stk-initiate', {
  body: JSON.stringify({
    phone: phoneNum,
    amount: amount
    // Server will use its own configured credentials
  })
})
```

### Priority 5: Secure Credential Storage

**Issue**: Credentials in plain localStorage

**Fix**: Store only on server, retrieve via admin API
```typescript
// Remove from settings.mpesa in localStorage
// Admin only accesses via secure API endpoint
const response = await fetch('/__admin/get-mpesa-credentials', {
  method: 'GET',
  headers: {
    'X-Admin-Token': getAdminToken()
  }
})

// On client: display masked values
// On server: actual secret credentials in secure storage
```

---

## Implementation Roadmap

### Phase 1: Fix Production API (Week 1-2)
- [ ] Implement actual M-Pesa API calls in `api.php`
- [ ] Add server-side credential retrieval
- [ ] Remove mock checkout IDs
- [ ] Implement B2C payment API

### Phase 2: Secure Credential Management (Week 2-3)
- [ ] Create `getAdminSettings()` helper in PHP
- [ ] Implement credential encryption at rest
- [ ] Update admin API to handle credentials securely
- [ ] Add audit logging for credential access

### Phase 3: Frontend Changes (Week 3-4)
- [ ] Remove `mpesa_creds` from request bodies
- [ ] Update components to call secure endpoints only
- [ ] Add server-side validation
- [ ] Test with actual M-Pesa sandbox

### Phase 4: Testing & Hardening (Week 4-5)
- [ ] Full integration test with M-Pesa
- [ ] Security audit of credential flow
- [ ] Load testing payment endpoints
- [ ] Update documentation

---

## Verification Checklist

- [ ] Admin settings properly saved to database
- [ ] Production API retrieves credentials from DB/settings
- [ ] M-Pesa API calls contain real transaction IDs
- [ ] Credentials never passed in request body
- [ ] Credentials encrypted at rest
- [ ] Fallback to env vars only if no admin config
- [ ] Audit logs for credential changes
- [ ] Callback handlers properly validate signatures
- [ ] STK Push and B2C endpoints both functional
- [ ] Query endpoints return real M-Pesa status

---

## Conclusion

The current M-Pesa credential system is **not production-ready**. While the admin settings UI exists, it's not integrated with the production API. Credentials are exposed on the client-side and the PHP backend returns simulated responses instead of calling M-Pesa.

**Immediate actions required**:
1. Implement server-side M-Pesa API integration
2. Remove credentials from frontend requests
3. Enforce admin settings as source of truth
4. Add proper error handling and logging
