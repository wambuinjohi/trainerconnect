# M-Pesa Callbacks Setup & Configuration Guide

## Overview

The system has **two callback handlers** that work together to process all M-Pesa transactions:

### 1. **C2B Callback** (`c2b_callback.php`)
- Handles **STK Push payments** (customer-to-business)
- Used for client payments via `ClientPaymentForm`
- Processes STK prompt results
- Updates STK session status in database
- Records completed payments

### 2. **B2C Callback** (`clientpaymentcallback.php`)
- Handles **B2C/Payout payments** (business-to-consumer)
- Used for trainer payouts and wallet withdrawals
- Processes M-Pesa B2C payment results
- Updates payout status
- Records transaction data from M-Pesa

---

## Callback URLs Configuration

### In M-Pesa Daraja Dashboard

Both callbacks must be configured at `https://trainer.skatryk.co.ke/`

#### 1. **STK Push Configuration**
- **Short Code**: Your M-Pesa shortcode (e.g., 174379)
- **STK Push Callback URL**: `https://trainer.skatryk.co.ke/c2b_callback.php`
- **Transaction Type**: Pull transactions
- **Confirmation URL** (optional): `https://trainer.skatryk.co.ke/c2b_callback.php`

#### 2. **B2C Payment Configuration**
- **Initiator Name**: Your API initiator account
- **B2C Result URL**: `https://trainer.skatryk.co.ke/clientpaymentcallback.php`
- **B2C Timeout URL**: `https://trainer.skatryk.co.ke/clientpaymentcallback.php`

---

## Database Tables Created for Callbacks

### 1. **stk_push_sessions**
Stores STK Push payment attempts and callback results

```
id                  - Session ID
phone_number        - Customer's M-Pesa phone
amount              - Payment amount
booking_id          - Booking reference (optional)
checkout_request_id - M-Pesa generated ID
status              - initiated, pending, success, failed, timeout
result_code         - M-Pesa result code
result_description  - M-Pesa result message
created_at          - Session start time
updated_at          - Last update time
```

### 2. **b2c_payment_callbacks**
Stores B2C payment callback responses from M-Pesa

```
id                              - Callback record ID
transaction_id                  - M-Pesa transaction ID (UNIQUE)
originator_conversation_id      - M-Pesa conversation ID
conversation_id                 - M-Pesa conversation ID
result_code                     - M-Pesa result code (0 = success)
result_description              - M-Pesa result description
transaction_amount              - Actual amount transferred
receiver_phone                  - Recipient phone number
reference_id                    - Link to b2c_payments table
raw_response                    - Full M-Pesa JSON response
received_at                     - Callback timestamp
```

### 3. **b2c_payments**
Stores B2C payment requests (before callback)

```
id              - B2C payment ID
user_id         - Recipient user ID
user_type       - trainer, client
phone_number    - Recipient phone
amount          - Payout amount
reference_id    - Unique reference (UNIQUE)
transaction_id  - M-Pesa transaction ID (populated by callback)
status          - pending, initiated, completed, failed
error_description - Error message if failed
initiated_at    - Request timestamp
completed_at    - Completion timestamp
updated_at      - Last update
```

---

## Payment Flow with Callbacks

### STK Push Flow (C2B)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client clicks "Pay" in ClientPaymentForm                 │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Frontend calls: POST /api.php                            │
│    action: "stk_push_initiate"                              │
│    phone: "254712345678"                                    │
│    amount: 1000                                             │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌───────────��─────────────────────────────────────────────────┐
│ 3. Backend creates STK session & gets CheckoutRequestID     │
│    Stores in: stk_push_sessions table                       │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. M-Pesa sends STK prompt to customer's phone             │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Customer enters PIN and completes payment                │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. M-Pesa sends callback to c2b_callback.php                │
│    POST with Body.stkCallback containing:                   │
│    - CheckoutRequestID                                      │
│    - ResultCode (0 = success)                               │
│    - MpesaReceiptNumber                                     │
│    - Amount                                                 │
│    - PhoneNumber                                            │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. c2b_callback.php processes:                              │
│    - Finds STK session by CheckoutRequestID                │
│    - Updates status to success/failed/timeout               │
│    - Records payment in payments table                      │
│    - Logs in c2b_callbacks.log                              │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Frontend polls stk_push_query & sees "success"           │
│    Payment complete!                                         │
└─────────────────────────────────────────────────────────────┘
```

### B2C Payout Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Trainer clicks "Request Payout"                          │
│    (in TrainerPayoutRequest component)                      │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Admin reviews & approves request                         │
│    (in AdminPayoutManager component)                        │
│    action: "payout_request_approve"                         │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. B2C payment created with commission deduction            │
│    Stored in: b2c_payments table                            │
│    status: "pending"                                        │
└─────────────────────────────────────���───────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Admin clicks "Initiate M-Pesa B2C"                       │
│    action: "b2c_payment_initiate"                           │
│    Updates b2c_payments status to: "initiated"              │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. M-Pesa processes B2C request                             │
│    Sends funds to trainer's phone                           │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────��──────────────────────────────────────────┐
│ 6. M-Pesa sends callback to clientpaymentcallback.php       │
│    POST with Result containing:                             │
│    - TransactionID                                          │
│    - ResultCode (0 = success)                               │
│    - TransactionAmount                                      │
│    - ReceiverPartyPublicName (phone)                        │
└─────────────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. clientpaymentcallback.php processes:                     │
│    - Stores callback in b2c_payment_callbacks               │
│    - Finds b2c_payments by reference_id                     │
│    - Updates status to completed/failed                     │
│    - Logs in b2c_callbacks.log                              │
└────────────��────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Admin sees updated status: "completed"                   │
│    Trainer receives funds!                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Callback Request/Response Formats

### C2B Callback Request (from M-Pesa)

```json
{
  "Body": {
    "stkCallback": {
      "MerchantCheckoutID": "WS_CO_191220191020375644",
      "CheckoutRequestID": "WS_CO_191220191020375644",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1000
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61SV"
          },
          {
            "Name": "TransactionDate",
            "Value": 20191219102115
          },
          {
            "Name": "PhoneNumber",
            "Value": 254729876543
          }
        ]
      }
    }
  }
}
```

**Response from c2b_callback.php:**
```json
{
  "success": true,
  "message": "C2B callback received and processed",
  "checkout_request_id": "WS_CO_191220191020375644"
}
```

### B2C Callback Request (from M-Pesa)

```json
{
  "Result": {
    "ResultType": 0,
    "ResultCode": 0,
    "ResultDesc": "The service request has been processed successfully.",
    "OriginatorConversationID": "16071-2344-7",
    "ConversationID": "AG_20191219_00004d34b9c11e1ae44a",
    "TransactionID": "LGR019G0M0UF",
    "ReferenceData": {
      "ReferenceItem": [
        {
          "Key": "TransactionAmount",
          "Value": 100
        },
        {
          "Key": "ReceiverPartyPublicName",
          "Value": "254712345678"
        },
        {
          "Key": "ReceiverPartyReferenceID",
          "Value": "11423"
        },
        {
          "Key": "TransactionCompletedDateTime",
          "Value": "19.12.2019 09:10:10"
        },
        {
          "Key": "ReceiptNo",
          "Value": "LGR019G0M0UF"
        },
        {
          "Key": "TransactionStatus",
          "Value": "Success"
        }
      ]
    }
  }
}
```

**Response from clientpaymentcallback.php:**
```json
{
  "success": true,
  "message": "Callback received and processed",
  "transaction_id": "LGR019G0M0UF"
}
```

---

## M-Pesa Result Codes

### Common Result Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Payment completed |
| 1 | Generic Error | Check error description |
| 1032 | STK timeout | User didn't enter PIN in time |
| 1033 | Customer rejection | User cancelled transaction |
| 1034 | Double debit | Check M-Pesa status |
| Other | Various errors | Refer to M-Pesa docs |

---

## Log Files

Both callbacks write detailed logs for debugging:

### C2B Logs: `c2b_callbacks.log`
```
{"timestamp":"2024-01-15 10:30:45","event_type":"c2b_received",...}
{"timestamp":"2024-01-15 10:30:46","event_type":"c2b_session_updated",...}
{"timestamp":"2024-01-15 10:30:47","event_type":"c2b_payment_recorded",...}
```

### B2C Logs: `b2c_callbacks.log`
```
{"timestamp":"2024-01-15 11:15:30","event_type":"b2c_received",...}
{"timestamp":"2024-01-15 11:15:31","event_type":"b2c_callback_stored",...}
{"timestamp":"2024-01-15 11:15:32","event_type":"b2c_payment_completed",...}
```

---

## Mobile App Configuration

Mobile apps should use the same domain for callbacks:

### Android
```java
private static final String API_BASE_URL = "https://trainer.skatryk.co.ke/";
```

### iOS
```swift
let apiBaseUrl = "https://trainer.skatryk.co.ke/"
```

### React Native
```javascript
const API_BASE_URL = 'https://trainer.skatryk.co.ke/';
```

---

## Testing Callbacks

### 1. Test C2B Callback (Manual POST)

```bash
curl -X POST https://trainer.skatryk.co.ke/c2b_callback.php \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "CheckoutRequestID": "WS_CO_TEST123",
        "ResultCode": 0,
        "ResultDesc": "Test successful",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 1000},
            {"Name": "MpesaReceiptNumber", "Value": "TEST123"},
            {"Name": "TransactionDate", "Value": "20240115102345"},
            {"Name": "PhoneNumber", "Value": "254712345678"}
          ]
        }
      }
    }
  }'
```

### 2. Test B2C Callback (Manual POST)

```bash
curl -X POST https://trainer.skatryk.co.ke/clientpaymentcallback.php \
  -H "Content-Type: application/json" \
  -d '{
    "Result": {
      "ResultCode": 0,
      "ResultDesc": "Test successful",
      "OriginatorConversationID": "test_001",
      "ConversationID": "test_conv_001",
      "TransactionID": "TEST_TXN_001",
      "ReferenceData": {
        "ReferenceItem": [
          {"Key": "TransactionAmount", "Value": 5000},
          {"Key": "ReceiverPartyPublicName", "Value": "254712345678"},
          {"Key": "ReferenceID", "Value": "payout_test_001"}
        ]
      }
    }
  }'
```

---

## Troubleshooting

### Callback Not Being Received

1. **Check URL Configuration**
   - Verify callbacks are registered in Daraja dashboard
   - Ensure domain is correctly configured: `https://trainer.skatryk.co.ke/`
   - Check for typos in callback paths

2. **Check DNS & Firewall**
   - Ping domain: `ping trainer.skatryk.co.ke`
   - Check if server accepts HTTPS on port 443
   - Verify firewall allows inbound from M-Pesa IPs

3. **Test Endpoint**
   ```bash
   curl -I https://trainer.skatryk.co.ke/c2b_callback.php
   curl -I https://trainer.skatryk.co.ke/clientpaymentcallback.php
   ```

### Callback Received But Not Processing

1. **Check PHP Errors**
   - Review server error logs
   - Check callback log files (`c2b_callbacks.log`, `b2c_callbacks.log`)

2. **Check Database Connection**
   - Verify `connection.php` is working
   - Test database connectivity
   - Check for table existence

3. **Check JSON Format**
   - Verify callback JSON is valid
   - Compare with expected format in documentation

### Payment Status Not Updating

1. **Check Session/Payment Records**
   ```sql
   SELECT * FROM stk_push_sessions WHERE checkout_request_id = 'YOUR_ID';
   SELECT * FROM b2c_payments WHERE reference_id = 'YOUR_REF';
   ```

2. **Check Callback Records**
   ```sql
   SELECT * FROM b2c_payment_callbacks WHERE transaction_id = 'YOUR_TXN_ID';
   ```

3. **Review Logs**
   - Check `c2b_callbacks.log` for STK Push issues
   - Check `b2c_callbacks.log` for B2C issues

---

## Security Considerations

1. **HTTPS Only**
   - All callbacks are HTTPS only
   - M-Pesa will not send to HTTP endpoints

2. **IP Whitelisting (Optional)**
   - Consider whitelisting M-Pesa IP ranges
   - Contact Safaricom for IP addresses

3. **Signature Validation (Optional)**
   - M-Pesa can sign callbacks (optional)
   - Implement signature verification for production

4. **Request Logging**
   - Both handlers log all incoming requests
   - Full JSON is stored in callback tables
   - Useful for debugging and compliance

5. **Idempotency**
   - Callbacks use unique transaction IDs
   - Database constraints prevent duplicate processing
   - Safe to receive same callback multiple times

---

## Next Steps

1. ✅ Ensure both callback files are at root:
   - `/c2b_callback.php` 
   - `/clientpaymentcallback.php`

2. ✅ Run database migration:
   ```bash
   php scripts/migrate_payment_tables_complete.php
   ```

3. ✅ Configure in M-Pesa Daraja Dashboard:
   - STK Push Callback: `https://trainer.skatryk.co.ke/c2b_callback.php`
   - B2C Result URL: `https://trainer.skatryk.co.ke/clientpaymentcallback.php`

4. ✅ Test with curl commands above

5. ✅ Monitor logs during initial testing

6. ✅ Implement in frontend components (already done):
   - ClientPaymentForm (STK Push)
   - WalletManager (B2C withdrawals)
   - AdminPayoutManager (B2C payouts)
