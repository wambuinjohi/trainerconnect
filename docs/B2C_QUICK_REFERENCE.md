# M-Pesa B2C Payment - Quick Reference Guide

---

## What is B2C?

**B2C = Business to Consumer**

Money flows from platform → user's M-Pesa wallet

**Use cases:**
- Weekly trainer payouts
- Client refunds
- Bonus payments
- Earnings withdrawals

---

## Database Tables

### `b2c_payments` - Payment Requests
```sql
INSERT INTO b2c_payments (
  id, user_id, user_type, phone_number, amount, 
  reference_id, status, initiated_at
) VALUES (
  UUID(), 'user_123', 'trainer', '254712345678', 
  1000.00, 'payout_ref_abc123', 'pending', NOW()
);
```

**Status values:**
- `pending` - Waiting for M-Pesa to process
- `completed` - Money sent successfully
- `failed` - Transaction failed

### `b2c_payment_callbacks` - M-Pesa Responses
Automatically populated by `/clientpaymentcallback.php`

**Fields populated from M-Pesa:**
- `transaction_id` - M-Pesa transaction ID
- `result_code` - 0 (success) or error code
- `transaction_amount` - Amount sent
- `receiver_phone` - User's phone number
- `raw_response` - Full JSON response

---

## Callback Flow

### What M-Pesa Sends to `/clientpaymentcallback.php`

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request has been processed successfully.",
    "OriginatorConversationID": "abc123",
    "ConversationID": "def456",
    "TransactionID": "LG453KKLLKK", 
    "ReferenceData": {
      "ReferenceItem": [
        { "Key": "TransactionAmount", "Value": "1000.00" },
        { "Key": "ReceiverPartyPublicName", "Value": "254712345678" },
        { "Key": "ReferenceID", "Value": "payout_ref_abc123" }
      ]
    }
  }
}
```

### What the Callback Handler Does

1. **Extracts data:**
   - `transaction_id` from `Result.TransactionID`
   - `amount` from `ReferenceData.TransactionAmount`
   - `reference_id` from `ReferenceData.ReferenceID`
   - `result_code` from `Result.ResultCode`

2. **Stores callback:**
   ```sql
   INSERT INTO b2c_payment_callbacks (
     transaction_id, result_code, result_description,
     transaction_amount, receiver_phone, reference_id,
     raw_response, received_at
   ) VALUES (...)
   ```

3. **Updates payment status:**
   - If `result_code = 0`: status = 'completed'
   - If `result_code ≠ 0`: status = 'failed'
   
   ```sql
   UPDATE b2c_payments 
   SET status = 'completed', transaction_id = '...', updated_at = NOW()
   WHERE reference_id = 'payout_ref_abc123';
   ```

4. **Returns 200 OK** to M-Pesa

---

## Common M-Pesa Result Codes

| Code | Meaning |
|------|---------|
| 0 | ✅ Success |
| 1 | Insufficient funds |
| 2 | Less than minimum transaction amount |
| 3 | More than maximum transaction amount |
| 5 | Transaction has expired |
| 11 | Deduction has failed |
| 20 | Request ID not found |
| 400 | Bad request |
| 401 | Unauthorized (credentials) |
| 403 | Forbidden - IP not whitelisted |
| 500 | Internal server error |

---

## Querying Payment Status

### Check a specific payout
```sql
SELECT * FROM b2c_payments 
WHERE reference_id = 'payout_ref_abc123';
```

### Find all pending payouts
```sql
SELECT * FROM b2c_payments 
WHERE status = 'pending';
```

### Find failed payouts
```sql
SELECT * FROM b2c_payments 
WHERE status = 'failed'
ORDER BY initiated_at DESC;
```

### Get callback details for a payout
```sql
SELECT cb.* FROM b2c_payment_callbacks cb
JOIN b2c_payments bp ON cb.reference_id = bp.reference_id
WHERE bp.id = 'payment_id_123';
```

### Check result codes distribution
```sql
SELECT result_code, COUNT(*) as count 
FROM b2c_payment_callbacks 
GROUP BY result_code;
```

---

## Debugging

### View callback logs
```bash
tail -f b2c_callbacks.log
```

### Check for duplicate transactions
```sql
SELECT transaction_id, COUNT(*) as count 
FROM b2c_payment_callbacks 
GROUP BY transaction_id 
HAVING COUNT(*) > 1;
```

### Find orphaned callbacks (no matching payment request)
```sql
SELECT * FROM b2c_payment_callbacks 
WHERE reference_id NOT IN (SELECT reference_id FROM b2c_payments);
```

### Check for pending payouts older than 24 hours
```sql
SELECT * FROM b2c_payments 
WHERE status = 'pending' 
AND initiated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

---

## API Endpoint (To Be Implemented)

### Initiate B2C Payout

**URL:** `POST /api.php`

**Payload:**
```json
{
  "action": "b2c_payment_initiate",
  "user_id": "user_123",
  "amount": 1000,
  "reason": "weekly_payout"
}
```

**Implementation pseudocode:**
```php
case 'b2c_payment_initiate':
    // Get user's phone from user_profiles
    $phone = fetch_user_phone($user_id);
    
    // Create reference ID
    $reference_id = 'payout_' . uniqid();
    
    // Store in b2c_payments table
    insert_b2c_payment($user_id, $phone, $amount, $reference_id);
    
    // Call M-Pesa B2C API
    $response = call_mpesa_b2c(
        amount: $amount,
        phone: $phone,
        result_url: 'https://trainer.skatryk.co.ke/clientpaymentcallback.php'
    );
    
    // Return reference_id for tracking
    respond('success', 'Payout initiated', ['reference_id' => $reference_id]);
    break;
```

---

## Environment Variables Required

```bash
# M-Pesa Credentials
MPESA_CONSUMER_KEY=<from Safaricom>
MPESA_CONSUMER_SECRET=<from Safaricom>
MPESA_SHORTCODE=<business shortcode>
MPESA_PASSKEY=<passkey for STK>
MPESA_ENVIRONMENT=sandbox  # or production

# Callback URL
MPESA_RESULT_URL=https://trainer.skatryk.co.ke/clientpaymentcallback.php
```

---

## Security Checklist

- [ ] HTTPS enforced on callback URL
- [ ] Database credentials secured
- [ ] Environment variables not in code
- [ ] Transaction IDs checked for uniqueness
- [ ] Reference IDs validated before processing
- [ ] Error messages don't leak sensitive data
- [ ] Callback logs monitored
- [ ] IP whitelisting configured (optional but recommended)

---

## Testing with Sandbox

1. **Get sandbox credentials** from M-Pesa Developer Portal
2. **Set `MPESA_ENVIRONMENT=sandbox`**
3. **Initiate a test B2C payment**
4. **Monitor `b2c_callbacks.log`** for callback receipt
5. **Check `b2c_payment_callbacks` table** for response
6. **Verify payment status** in `b2c_payments`

---

## File Locations

| File | Purpose |
|------|---------|
| `/clientpaymentcallback.php` | Receives M-Pesa callbacks |
| `/scripts/migrate_b2c_payments_table.php` | Creates database tables |
| `/b2c_callbacks.log` | Event log (created automatically) |
| `/docs/MPESA_B2C_AUDIT.md` | Full documentation |
| `/docs/B2C_IMPLEMENTATION_SUMMARY.md` | Implementation overview |

---

## Helpful SQL Queries

### Create a test payout
```sql
INSERT INTO b2c_payments (
  user_id, user_type, phone_number, amount, reference_id, status
) VALUES (
  'user_test_123', 'trainer', '254712345678', 100, 
  'test_payout_' . UNIX_TIMESTAMP(), 'pending'
);
```

### View all transactions from last 7 days
```sql
SELECT bp.*, cb.result_code, cb.result_description
FROM b2c_payments bp
LEFT JOIN b2c_payment_callbacks cb 
  ON bp.reference_id = cb.reference_id
WHERE bp.initiated_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY bp.initiated_at DESC;
```

### Calculate total successful payouts
```sql
SELECT 
  DATE(bp.completed_at) as date,
  COUNT(*) as count,
  SUM(bp.amount) as total
FROM b2c_payments bp
WHERE bp.status = 'completed'
GROUP BY DATE(bp.completed_at)
ORDER BY bp.completed_at DESC;
```

---

**Last Updated:** 2024  
**Status:** Ready for Implementation ✓
