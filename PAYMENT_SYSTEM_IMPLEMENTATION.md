# Complete Payment System Implementation Guide

## Overview

This document outlines the complete payment system implementation including:
- **STK Push Payments**: Client payments via M-Pesa (persistent until paid)
- **Wallet Management**: User wallet system with balance tracking
- **Trainer Payouts**: Trainers request payments from admin (minus commissions)
- **Admin B2C Payments**: Admin initiates business-to-consumer payments
- **Payment History & Tracking**: Comprehensive payment status tracking

---

## System Architecture

### Payment Flow Diagram

```
CLIENT PAYMENT FLOW:
┌─────────────────────────────────────────────────────────────┐
│ Client initiates payment via STK Push                        │
│ 1. Enter phone number and amount                             │
│ 2. System sends STK prompt to M-Pesa                         │
│ 3. Client enters PIN on phone                                │
│ 4. M-Pesa sends result code back                             │
│ 5. System records payment in database                         │
└─────────────────────────────────────────────────────────────┘

TRAINER PAYOUT FLOW:
┌─────────────────────────────────────────────────────────────┐
│ Trainer requests payout from available balance               │
│ 1. Trainer enters amount and submits request                 │
│ 2. Request appears in Admin Payout Manager                   │
│ 3. Admin reviews and approves with commission %              │
│ 4. B2C payment record created automatically                  │
│ 5. Admin initiates B2C payment to trainer's phone            │
│ 6. M-Pesa processes and sends funds                          │
│ 7. Callback updates payment status                           │
└─────────────────────────────────────────────────────────────┘

WALLET MANAGEMENT FLOW:
┌─────────────────────────────────────────────────────────────┐
│ Users can top up or withdraw from wallet                     │
│ 1. User enters amount in Wallet Manager                      │
│ 2. Top-up: Uses STK Push to add funds                        │
│ 3. Withdraw: Initiates B2C to withdraw funds                 │
│ 4. Transactions recorded in wallet_transactions table        │
│ 5. Balance updated in real-time                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. **stk_push_sessions**
Tracks STK Push payment attempts and results.

```sql
- id: Session ID
- phone_number: M-Pesa registered phone
- amount: Payment amount
- checkout_request_id: M-Pesa reference
- status: initiated, pending, success, failed, timeout
- result_code: M-Pesa result code
- created_at: Session creation time
```

#### 2. **user_wallets**
Maintains user wallet balances.

```sql
- user_id: User reference
- balance: Total balance
- available_balance: Available to withdraw
- pending_balance: Awaiting confirmation
- total_earned: Cumulative earnings
- total_withdrawn: Cumulative withdrawals
```

#### 3. **wallet_transactions**
Transaction history for audit trail.

```sql
- user_id: User reference
- type: deposit, withdrawal, commission, refund, payment
- amount: Transaction amount
- reference: External reference ID
- description: Human-readable description
- balance_after: Balance after transaction
- status: pending, completed, failed
```

#### 4. **payments**
Records all payments in the system.

```sql
- user_id/client_id/trainer_id: Parties involved
- amount: Payment amount
- status: pending, completed, failed, refunded
- method: mpesa, stk, card, bank, wallet, b2c
- transaction_reference: M-Pesa reference
```

#### 5. **b2c_payments**
M-Pesa Business-to-Consumer (payout) records.

```sql
- user_id: Recipient user
- phone_number: Recipient phone
- amount: Payout amount
- reference_id: Unique reference for callbacks
- transaction_id: M-Pesa transaction ID
- status: pending, initiated, completed, failed
```

#### 6. **b2c_payment_callbacks**
M-Pesa callback data storage.

```sql
- transaction_id: M-Pesa transaction ID
- result_code: M-Pesa result code
- result_description: Result message
- reference_id: Link to b2c_payments
- raw_response: Full M-Pesa response JSON
```

#### 7. **payout_requests**
Trainer payout requests and approvals.

```sql
- trainer_id: Trainer user ID
- amount: Requested amount
- commission: Admin deduction percentage
- net_amount: Amount after commission
- status: pending, approved, completed, rejected
- b2c_payment_id: Link to actual B2C payment
```

#### 8. **payment_methods**
Saved payment methods for quick access.

```sql
- user_id: User reference
- type: mpesa, card, bank
- phone_number/card_last_four/bank_account
- is_default: Default payment method
```

---

## API Endpoints

### STK Push Endpoints

#### 1. **stk_push_initiate**
Initiates an STK Push payment request.

**Request:**
```json
{
  "action": "stk_push_initiate",
  "phone": "254712345678",
  "amount": 1000,
  "booking_id": "booking_123",
  "account_reference": "booking_123",
  "transaction_description": "Service Payment"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "session_id": "stk_abc123",
    "CheckoutRequestID": "WS_CO_123456",
    "phone": "254712345678",
    "amount": 1000
  }
}
```

#### 2. **stk_push_query**
Queries the status of an STK Push payment.

**Request:**
```json
{
  "action": "stk_push_query",
  "checkout_request_id": "WS_CO_123456"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "session_id": "stk_abc123",
    "status": "success|pending|failed|timeout",
    "result_code": "0",
    "result_description": "Success message"
  }
}
```

#### 3. **stk_push_callback**
Handles M-Pesa STK Push callback (internal).

#### 4. **stk_push_history**
Retrieves STK Push transaction history.

**Request:**
```json
{
  "action": "stk_push_history",
  "limit": 20,
  "offset": 0
}
```

### Wallet Endpoints

#### 1. **wallet_get**
Retrieves user's wallet information.

**Request:**
```json
{
  "action": "wallet_get",
  "user_id": "user_123"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "wallet_123",
    "user_id": "user_123",
    "balance": 5000.00,
    "available_balance": 5000.00,
    "pending_balance": 0.00,
    "total_earned": 50000.00,
    "total_withdrawn": 45000.00
  }
}
```

#### 2. **wallet_update**
Updates wallet balance (deposits, withdrawals, commissions).

**Request:**
```json
{
  "action": "wallet_update",
  "user_id": "user_123",
  "amount": 1000,
  "transaction_type": "deposit|withdrawal|commission|refund|payment",
  "reference": "stk_abc123",
  "description": "Wallet top-up via M-Pesa"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user_id": "user_123",
    "old_balance": 5000.00,
    "amount": 1000.00,
    "new_balance": 6000.00,
    "transaction_id": "txn_xyz789"
  }
}
```

#### 3. **wallet_transactions_get**
Retrieves wallet transaction history.

**Request:**
```json
{
  "action": "wallet_transactions_get",
  "user_id": "user_123",
  "limit": 20,
  "offset": 0
}
```

### Payout Management Endpoints

#### 1. **payout_insert**
Trainer submits a payout request.

**Request:**
```json
{
  "action": "payout_insert",
  "trainer_id": "trainer_123",
  "amount": 5000,
  "status": "pending"
}
```

#### 2. **payout_requests_get**
Admin retrieves pending or approved payout requests.

**Request:**
```json
{
  "action": "payout_requests_get",
  "status": "pending|approved"
}
```

#### 3. **payout_request_approve**
Admin approves a payout and creates B2C payment.

**Request:**
```json
{
  "action": "payout_request_approve",
  "payout_request_id": "payout_123",
  "commission_percentage": 5
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "b2c_payment_id": "b2c_123",
    "reference_id": "payout_xyz",
    "net_amount": 4750,
    "commission": 250
  }
}
```

### B2C Payment Endpoints

#### 1. **b2c_payment_initiate**
Initiates a B2C payment (payout to user).

**Request:**
```json
{
  "action": "b2c_payment_initiate",
  "b2c_payment_id": "b2c_123",
  "phone_number": "254712345678",
  "amount": 4750
}
```

#### 2. **b2c_payment_status**
Retrieves B2C payment status.

**Request:**
```json
{
  "action": "b2c_payment_status",
  "b2c_payment_id": "b2c_123"
}
```

#### 3. **b2c_payments_get**
Retrieves all B2C payments (admin view).

**Request:**
```json
{
  "action": "b2c_payments_get",
  "trainer_id": "trainer_123",
  "status": "pending|initiated|completed|failed"
}
```

---

## React Components

### Client Components

#### 1. **ClientPaymentForm**
Initiates STK Push payments for client bookings.

**Props:**
```typescript
{
  bookingId?: string
  amount: number
  onSuccess?: () => void
}
```

**Features:**
- Phone number input and validation
- Real-time payment status polling
- Success/failure/timeout handling
- Session persistence (localStorage)

#### 2. **WalletManager**
Complete wallet management interface.

**Features:**
- View wallet balance (total, available, pending)
- Top-up via STK Push
- Withdraw via B2C
- Transaction history with filtering
- CSV export functionality

#### 3. **STKPushTracker**
Tracks all STK Push transactions.

**Features:**
- Transaction summary stats
- Filtered views (all, successful, pending, failed)
- Manual status refresh
- Detailed transaction information
- Payment status monitoring

#### 4. **PaymentHistory**
Comprehensive payment history display.

**Features:**
- Filters by status and method
- Transaction details
- Summary statistics
- CSV export

### Trainer Components

#### 1. **TrainerPayoutRequest**
Trainer payout request submission.

**Features:**
- View available balance
- Submit payout request
- View request history
- Status tracking (pending, approved, completed)

### Admin Components

#### 1. **AdminPayoutManager**
Complete payout management for admins.

**Features:**
- Commission percentage settings
- Pending requests review
- Approve with automatic B2C creation
- B2C payment initiation
- Payment status tracking
- Processed requests view

---

## Setup Instructions

### 1. Database Migration

Run the comprehensive migration script to create all tables:

```bash
php scripts/migrate_payment_tables_complete.php
```

This creates:
- stk_push_sessions
- user_wallets
- wallet_transactions
- payments
- b2c_payments
- b2c_payment_callbacks
- payout_requests
- payment_methods

### 2. API Configuration

Ensure these endpoints are available in your API:
- `/api.php` handles all actions via the `action` parameter
- `/clientpaymentcallback.php` handles M-Pesa B2C callbacks

### 3. Component Integration

#### In Client Dashboard:
```tsx
import { ClientPaymentForm } from '@/components/client/ClientPaymentForm'
import { WalletManager } from '@/components/client/WalletManager'
import { STKPushTracker } from '@/components/client/STKPushTracker'
import { PaymentHistory } from '@/components/shared/PaymentHistory'

// Use in your component:
<ClientPaymentForm bookingId={bookingId} amount={amount} onSuccess={handleSuccess} />
<WalletManager />
<STKPushTracker />
<PaymentHistory />
```

#### In Trainer Dashboard:
```tsx
import { TrainerPayoutRequest } from '@/components/trainer/TrainerPayoutRequest'

// Use in your component:
<TrainerPayoutRequest />
```

#### In Admin Dashboard:
```tsx
import { AdminPayoutManager } from '@/components/admin/AdminPayoutManager'

// Use in your component:
<AdminPayoutManager />
```

### 4. Environment Setup

Ensure your M-Pesa API credentials are configured:
- **Daraja API Endpoint**: https://sandbox.safaricom.co.ke/oauth/v1/generate (sandbox)
- **Consumer Key**: From M-Pesa Daraja
- **Consumer Secret**: From M-Pesa Daraja
- **Business Code**: Shortcode for API calls
- **Passkey**: M-Pesa passkey

These should be securely stored in `.env` file or server configuration.

---

## Payment Flow Examples

### Example 1: Client STK Push Payment

1. **Client initiates payment:**
   ```javascript
   POST /api.php
   {
     "action": "stk_push_initiate",
     "phone": "254712345678",
     "amount": 1000,
     "booking_id": "booking_123"
   }
   ```

2. **Frontend polls for status:**
   ```javascript
   POST /api.php
   {
     "action": "stk_push_query",
     "checkout_request_id": "WS_CO_123456"
   }
   ```

3. **Upon success:**
   - Payment recorded
   - Booking marked as paid
   - Receipt sent to client

### Example 2: Trainer Payout Request

1. **Trainer submits request:**
   ```javascript
   POST /api.php
   {
     "action": "payout_insert",
     "trainer_id": "trainer_123",
     "amount": 5000
   }
   ```

2. **Admin approves:**
   ```javascript
   POST /api.php
   {
     "action": "payout_request_approve",
     "payout_request_id": "payout_123",
     "commission_percentage": 5
   }
   ```

3. **Admin initiates B2C:**
   ```javascript
   POST /api.php
   {
     "action": "b2c_payment_initiate",
     "b2c_payment_id": "b2c_123",
     "phone_number": "254712345678",
     "amount": 4750
   }
   ```

4. **M-Pesa sends callback:**
   - POST to `/clientpaymentcallback.php`
   - System updates payment status
   - Trainer receives funds

### Example 3: Wallet Top-up

1. **User initiates top-up:**
   ```javascript
   // Initiate STK Push
   POST /api.php
   {
     "action": "stk_push_initiate",
     "phone": "254712345678",
     "amount": 2000,
     "account_reference": "wallet_topup_user_123"
   }
   ```

2. **Poll for completion:**
   ```javascript
   POST /api.php
   {
     "action": "stk_push_query",
     "checkout_request_id": "WS_CO_789456"
   }
   ```

3. **Update wallet on success:**
   ```javascript
   POST /api.php
   {
     "action": "wallet_update",
     "user_id": "user_123",
     "amount": 2000,
     "transaction_type": "deposit",
     "reference": "stk_789456",
     "description": "M-Pesa wallet top-up"
   }
   ```

---

## Status Codes & Error Handling

### M-Pesa Result Codes
- **0**: Success
- **1032**: STK popup timeout (user didn't enter PIN)
- **1**: Generic error
- **Other codes**: Refer to M-Pesa documentation

### API Response Statuses
- **success**: Operation completed successfully
- **error**: Operation failed, check message field

### Payment Statuses
- **initiated**: STK prompt sent, awaiting user action
- **pending**: Payment pending verification
- **success**: Payment completed successfully
- **failed**: Payment failed
- **timeout**: STK prompt expired

---

## Security Considerations

1. **Phone Number Validation**
   - Always validate phone format
   - Normalize to 254 format
   - Verify length (12 digits)

2. **Amount Validation**
   - Set minimum (10 Ksh)
   - Set maximum (150,000 Ksh)
   - Validate against wallet balance

3. **Authentication**
   - All endpoints require user authentication
   - Check user ownership of resources
   - Implement rate limiting

4. **Callback Security**
   - Validate M-Pesa signature
   - Verify callback origin
   - Idempotent callback handling
   - Log all callbacks

5. **Commission Handling**
   - Deduct from original amount
   - Clear audit trail
   - Prevent manipulation

---

## Troubleshooting

### Issue: STK Prompt Not Appearing
1. Check phone number format (should be 254XXXXXXXXX)
2. Verify M-Pesa API credentials
3. Ensure Daraja API is accessible
4. Check M-Pesa account balance

### Issue: Payment Status Not Updating
1. Check polling interval (should be 2-5 seconds)
2. Verify database connectivity
3. Check M-Pesa callback handler
4. Review logs for errors

### Issue: Wallet Balance Not Updating
1. Verify wallet record exists
2. Check transaction type is valid
3. Ensure sufficient balance for withdrawals
4. Review error messages in response

### Issue: B2C Payment Stuck
1. Check phone number is valid
2. Verify amount is within limits
3. Review M-Pesa callback logs
4. Check reference_id is unique

---

## Testing Checklist

- [ ] Client STK Push payment flow
- [ ] Payment status polling and updates
- [ ] Session persistence across page reloads
- [ ] Trainer payout request submission
- [ ] Admin payout approval with commissions
- [ ] B2C payment initiation
- [ ] M-Pesa callback handling
- [ ] Wallet balance updates
- [ ] Wallet transactions recording
- [ ] Payment history display
- [ ] Error handling and validation
- [ ] Transaction idempotency
- [ ] Concurrent payment handling
- [ ] Database integrity

---

## Future Enhancements

1. **Payment Reconciliation**
   - Automated daily reconciliation
   - Discrepancy alerts
   - Manual adjustment workflow

2. **Payment Analytics**
   - Revenue reports
   - Payout trends
   - User payment patterns

3. **Refund System**
   - Automated refunds
   - Partial refunds
   - Refund status tracking

4. **Payment Notifications**
   - Email receipts
   - SMS alerts
   - In-app notifications

5. **Multi-Currency Support**
   - USD, EUR, etc.
   - Real-time exchange rates
   - Currency preference

---

## Support & Documentation

- M-Pesa Daraja API: https://developer.safaricom.co.ke/
- M-Pesa Result Codes: https://developer.safaricom.co.ke/docs
- Component Documentation: See individual component files
- API Documentation: See API endpoint details above
