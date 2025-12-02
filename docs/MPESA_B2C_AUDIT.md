# M-Pesa B2C Payment Implementation Audit

**Date:** 2024  
**System:** Trainer Coach Connect - Client Payment Service  
**Scope:** M-Pesa B2C (Business to Consumer) payment flow for platform payouts

---

## Executive Summary

This document audits the M-Pesa B2C payment implementation for client/trainer payouts. The system uses M-Pesa's B2C API to send funds from the platform to individual users. A callback handler and database migrations have been created to properly track and manage these transactions.

---

## Current Architecture

### Payment Flows

#### 1. **C2B Flow (Client to Business) - STK Push**
- **Status:** ✅ Implemented
- **Files:**
  - Frontend: `src/components/trainer/TrainerTopUp.tsx`
  - Vite Config: `vite.config.ts` (lines 136-180)
  - Endpoint: `/payments/mpesa/stk-initiate`
- **Flow:**
  1. User initiates top-up/payment
  2. STK push prompt sent to user's phone
  3. User enters M-Pesa PIN
  4. Payment confirmed via polling (`/payments/mpesa/stk-query`)
  5. Payment recorded in `payments` table via `payment_insert` API

#### 2. **B2C Flow (Business to Consumer) - NEW**
- **Status:** ✅ Now Implemented
- **Files:**
  - Callback Handler: `/clientpaymentcallback.php` (NEW)
  - Migrations: `scripts/migrate_b2c_payments_table.php` (NEW)
  - Database Tables: `b2c_payments`, `b2c_payment_callbacks` (NEW)
- **Flow:**
  1. Platform initiates B2C payout request to M-Pesa API
  2. M-Pesa sends callback to `/clientpaymentcallback.php`
  3. Callback handler validates and stores response
  4. Payment status updated in `b2c_payments` table
  5. User receives money in M-Pesa wallet

---

## Database Schema

### Existing Tables

#### `payments` Table
Stores C2B (client-initiated) and general transaction records.

```sql
CREATE TABLE payments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  booking_id VARCHAR(36),
  amount DECIMAL(15, 2),
  status VARCHAR(50) DEFAULT 'pending',
  method VARCHAR(50),          -- 'mpesa', 'card', etc.
  transaction_reference VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### New Tables

#### `b2c_payments` Table
Stores B2C payment requests initiated by the platform.

```sql
CREATE TABLE b2c_payments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),              -- Trainer/Client receiving payout
  user_type VARCHAR(20),            -- 'trainer' or 'client'
  phone_number VARCHAR(20),         -- M-Pesa phone number
  amount DECIMAL(15, 2),
  reference_id VARCHAR(255),        -- Unique reference for callback matching
  transaction_id VARCHAR(255),      -- M-Pesa transaction ID (after success)
  status VARCHAR(50),               -- 'pending', 'completed', 'failed'
  error_description TEXT,           -- Error message if failed
  reason_code VARCHAR(100),         -- M-Pesa result code
  initiated_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP
);

Indexes:
- idx_user_id
- idx_reference_id
- idx_transaction_id
- idx_status
- idx_initiated_at
```

#### `b2c_payment_callbacks` Table
Stores all M-Pesa callback responses for audit trail.

```sql
CREATE TABLE b2c_payment_callbacks (
  id VARCHAR(36) PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE,      -- M-Pesa transaction ID
  originator_conversation_id VARCHAR(255), -- M-Pesa conversation ID
  conversation_id VARCHAR(255),
  result_code INT,                         -- 0 = success
  result_description TEXT,
  transaction_amount DECIMAL(15, 2),
  receiver_phone VARCHAR(20),
  reference_id VARCHAR(255),               -- Links to b2c_payments
  raw_response LONGTEXT,                   -- Full JSON response
  received_at TIMESTAMP
);

Indexes:
- idx_transaction_id (unique)
- idx_reference_id
- idx_result_code
- idx_received_at
```

---

## Callback Handler: `clientpaymentcallback.php`

### Location
`https://trainer.skatryk.co.ke/clientpaymentcallback.php`

### Purpose
Receives and processes M-Pesa B2C payment callbacks.

### Expected Callback Format (from M-Pesa)
```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request has been processed successfully.",
    "OriginatorConversationID": "...",
    "ConversationID": "...",
    "TransactionID": "...",
    "ReferenceData": {
      "ReferenceItem": [
        { "Key": "TransactionAmount", "Value": 100.00 },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678" },
        { "Key": "ReferenceID", "Value": "payout_ref_..." }
      ]
    }
  }
}
```

### Handler Workflow
1. **Receive Request** → Parse JSON from M-Pesa
2. **Extract Data** → Transaction ID, amount, phone, reference ID, result code
3. **Store Callback** → Insert into `b2c_payment_callbacks` table
4. **Update Status** → Mark payment as completed/failed in `b2c_payments`
5. **Acknowledge** → Return 200 OK to M-Pesa
6. **Log Event** → Write to `b2c_callbacks.log` for audit trail

### Response
```json
{
  "success": true,
  "message": "Callback received and processed",
  "transaction_id": "..."
}
```

---

## M-Pesa Configuration

### Required Environment Variables
```
MPESA_CONSUMER_KEY=<from Safaricom>
MPESA_CONSUMER_SECRET=<from Safaricom>
MPESA_SHORTCODE=<Business shortcode for B2C>
MPESA_PASSKEY=<Passkey for STK push>
MPESA_ENVIRONMENT=sandbox|production
MPESA_RESULT_URL=https://trainer.skatryk.co.ke/clientpaymentcallback.php
```

### API Endpoints Used

#### STK Push (C2B)
```
POST https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
(or production URL)

Credentials: OAuth token + consumer credentials
```

#### B2C Payment Request
```
POST https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest
(or production URL)

Required Fields:
- InitiatorName: Platform name/ID
- SecurityCredential: Encrypted password
- CommandID: 'BusinessPayment' or 'SalaryPayment'
- Amount: Payout amount
- PartyA: Business shortcode
- PartyB: Recipient phone number
- Remarks: Transaction description
- QueueTimeOutURL: (optional)
- ResultURL: https://trainer.skatryk.co.ke/clientpaymentcallback.php
```

---

## Setup Instructions

### 1. Install Migration

```bash
php scripts/migrate_b2c_payments_table.php
```

This creates:
- `b2c_payments` table (tracks outgoing B2C payments)
- `b2c_payment_callbacks` table (stores M-Pesa responses)

### 2. Configure Environment Variables

Set in your deployment environment:
```bash
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_ENVIRONMENT=sandbox  # or production
MPESA_RESULT_URL=https://trainer.skatryk.co.ke/clientpaymentcallback.php
```

### 3. Deploy Callback Handler

The file `/clientpaymentcallback.php` should be deployed to the root directory of your domain.

### 4. Register with M-Pesa

Update your M-Pesa account settings to use:
- **B2C Callback URL:** `https://trainer.skatryk.co.ke/clientpaymentcallback.php`

---

## Security Considerations

### ✅ Implemented

1. **No authentication required for callback** (M-Pesa callbacks are sent server-to-server)
2. **HTTPS enforcement** (all M-Pesa requests must be over HTTPS)
3. **Transaction ID uniqueness** (prevents duplicate processing)
4. **Reference ID matching** (links callbacks to payment requests)
5. **Full audit trail** (all callbacks logged to `b2c_callbacks.log`)
6. **Error handling** (graceful failure handling, always return 200 to M-Pesa)

### ⚠️ Recommendations

1. **Add IP Whitelisting**
   ```php
   $allowedIPs = ['196.201.214.0/24']; // Safaricom's IP range
   if (!in_array($_SERVER['REMOTE_ADDR'], $allowedIPs)) {
       // Reject request
   }
   ```

2. **Validate Transaction Amount**
   ```php
   // Verify amount matches what was requested
   $requestedAmount = /* fetch from b2c_payments */;
   if ($transactionAmount != $requestedAmount) {
       // Log security warning
   }
   ```

3. **Implement Request Signing** (Optional)
   ```php
   // M-Pesa can sign the callback
   // Verify signature before processing
   ```

4. **Monitor Callback Logs**
   ```bash
   tail -f b2c_callbacks.log
   ```

---

## Implementation Checklist

- [x] Create callback handler (`clientpaymentcallback.php`)
- [x] Create database tables (`b2c_payments`, `b2c_payment_callbacks`)
- [x] Create migration script (`migrate_b2c_payments_table.php`)
- [x] Document API format and flow
- [ ] Implement B2C payment initiation endpoint in `api.php`
- [ ] Create B2C payout request form in frontend
- [ ] Add payment status tracking UI
- [ ] Implement webhook signature validation (optional)
- [ ] Set up monitoring and alerts for failed payments
- [ ] Test with M-Pesa sandbox environment
- [ ] Deploy to production with proper credentials

---

## Monitoring and Debugging

### View Callback Logs
```bash
tail -f b2c_callbacks.log
```

### Query Payment Status
```sql
-- All pending B2C payments
SELECT * FROM b2c_payments WHERE status = 'pending';

-- All completed payments
SELECT * FROM b2c_payments WHERE status = 'completed';

-- Failed payments with error details
SELECT * FROM b2c_payments WHERE status = 'failed';

-- Callback details for a transaction
SELECT * FROM b2c_payment_callbacks 
WHERE transaction_id = '...';
```

### Common M-Pesa Result Codes
```
0   = Success
1   = Insufficient funds
2   = Less than minimum transaction amount
3   = More than maximum transaction amount
5   = Transaction has expired
11  = Deduction has failed
20  = Request ID not found
400 = Bad request
401 = Unauthorized
403 = Forbidden - IP not whitelisted
404 = Not found
500 = Internal server error
```

---

## API Endpoint (Future)

### Initiate B2C Payout

**Request:**
```json
{
  "action": "b2c_payment_initiate",
  "user_id": "user_123",
  "amount": 1000,
  "reason": "weekly_payout",
  "description": "Weekly earnings payout"
}
```

**Response (on success):**
```json
{
  "status": "success",
  "message": "Payout initiated",
  "data": {
    "reference_id": "payout_ref_...",
    "status": "pending",
    "amount": 1000
  }
}
```

---

## Troubleshooting

### Callback Not Received
- [ ] Verify callback URL is publicly accessible
- [ ] Check firewall/routing rules
- [ ] Verify HTTPS certificate is valid
- [ ] Check M-Pesa account settings for correct URL

### Callback Received but Payment Not Updated
- [ ] Check database connection in callback handler
- [ ] Verify `b2c_payments` table exists
- [ ] Check for errors in `b2c_callbacks.log`
- [ ] Verify reference_id matches

### Duplicate Callbacks
- [ ] `transaction_id` column has UNIQUE constraint
- [ ] ON DUPLICATE KEY UPDATE prevents double-processing
- [ ] Check logs for duplicate callback warnings

---

## Next Steps

1. **Run Migration**
   ```bash
   php scripts/migrate_b2c_payments_table.php
   ```

2. **Deploy Callback Handler**
   - Upload `clientpaymentcallback.php` to root directory
   - Verify it's accessible at `https://trainer.skatryk.co.ke/clientpaymentcallback.php`

3. **Implement B2C Initiator**
   - Create `b2c_payment_initiate` action in `api.php`
   - Call M-Pesa B2C API
   - Store request in `b2c_payments` table

4. **Test with Sandbox**
   - Use M-Pesa sandbox credentials
   - Test end-to-end flow
   - Verify callback handling

5. **Deploy to Production**
   - Update environment variables
   - Update callback URL in M-Pesa account
   - Monitor logs for issues

---

## References

- [M-Pesa B2C API Documentation](https://developer.safaricom.co.ke/apis/b2c)
- [M-Pesa STK Push API](https://developer.safaricom.co.ke/apis/stk-push)
- [M-Pesa Callback Documentation](https://developer.safaricom.co.ke/documentation)

---

**Audit Complete** ✓
