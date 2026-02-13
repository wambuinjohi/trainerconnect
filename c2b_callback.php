<?php
/**
 * M-Pesa C2B (STK Push) Payment Callback Handler
 * 
 * This callback is invoked by Safaricom's M-Pesa API when an STK Push payment
 * (customer-to-business) is completed or fails. Used for client payments.
 * 
 * Callback URL: https://trainercoachconnect.com/c2b_callback.php
 * 
 * Expected POST format from M-Pesa (STK Push):
 * {
 *   "Body": {
 *     "stkCallback": {
 *       "MerchantCheckoutID": "WS_CO_191220191020375644",
 *       "CheckoutRequestID": "WS_CO_191220191020375644",
 *       "ResultCode": 0,
 *       "ResultDesc": "The service request has been processed successfully.",
 *       "CallbackMetadata": {
 *         "Item": [
 *           {
 *             "Name": "Amount",
 *             "Value": 1000
 *           },
 *           {
 *             "Name": "MpesaReceiptNumber",
 *             "Value": "NLJ7RT61SV"
 *           },
 *           {
 *             "Name": "TransactionDate",
 *             "Value": 20191219102115
 *           },
 *           {
 *             "Name": "PhoneNumber",
 *             "Value": 254729876543
 *           }
 *         ]
 *       }
 *     }
 *   }
 * }
 */

// Disable output buffering and output directly
if (ob_get_level()) {
    ob_end_clean();
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set headers BEFORE any output
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
}

// Include database connection
require_once(__DIR__ . '/connection.php');

// Utility function for logging
function logC2BEvent($type, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => 'c2b_' . $type,
        'client_ip' => $clientIp,
    ];
    
    $logEntry = array_merge($logEntry, $details);
    error_log(json_encode($logEntry));
    
    $logFile = __DIR__ . '/c2b_callbacks.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

try {
    // Get raw request body
    $rawRequest = file_get_contents('php://input');

    // Log raw request for debugging
    file_put_contents('mpesa_callback_raw.txt', "[" . date('Y-m-d H:i:s') . "] Raw request (" . strlen($rawRequest) . " bytes): " . substr($rawRequest, 0, 500) . "\n", FILE_APPEND | LOCK_EX);

    $requestData = json_decode($rawRequest, true);

    // M-Pesa sends empty requests to validate the callback URL
    // We must return HTTP 200 for validation to pass
    if (!$requestData || empty($rawRequest)) {
        logC2BEvent('validation_probe', [
            'raw_length' => strlen($rawRequest),
            'decoded' => $requestData
        ]);
        // Always return 200 OK for M-Pesa validation probes
        // Use M-Pesa standard response format
        http_response_code(200);
        echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
        exit;
    }

    // Log the incoming request
    logC2BEvent('received', ['request_keys' => array_keys($requestData)]);

    // Extract STK callback data
    $body = $requestData['Body'] ?? null;
    $stkCallback = $body['stkCallback'] ?? null;

    if (!$stkCallback) {
        logC2BEvent('missing_stkcallback', ['request' => $requestData]);
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing stkCallback object']);
        exit;
    }

    // Log full callback structure for debugging
    error_log("[C2B CALLBACK DEBUG] STK Callback Full Data: " . json_encode($stkCallback, JSON_PRETTY_PRINT));

    $resultCode = intval($stkCallback['ResultCode'] ?? 1);
    $resultDesc = $stkCallback['ResultDesc'] ?? 'Unknown error';
    $checkoutRequestId = $stkCallback['CheckoutRequestID'] ?? null;
    $merchantCheckoutId = $stkCallback['MerchantCheckoutID'] ?? null;
    $merchantRequestId = $stkCallback['MerchantRequestID'] ?? null;

    error_log("[C2B CALLBACK DEBUG] Parsed Values - ResultCode: $resultCode, ResultDesc: $resultDesc, CheckoutRequestID: $checkoutRequestId");
    
    // Parse callback metadata
    $amount = null;
    $mpesaReceiptNumber = null;
    $transactionDate = null;
    $phoneNumber = null;

    // Debug: Check if CallbackMetadata exists
    if (!isset($stkCallback['CallbackMetadata'])) {
        error_log("[C2B CALLBACK DEBUG] No CallbackMetadata found in callback (expected for failed transactions)");
    } else {
        error_log("[C2B CALLBACK DEBUG] CallbackMetadata exists: " . json_encode($stkCallback['CallbackMetadata'], JSON_PRETTY_PRINT));
    }

    if (isset($stkCallback['CallbackMetadata']['Item'])) {
        error_log("[C2B CALLBACK DEBUG] Found " . count($stkCallback['CallbackMetadata']['Item']) . " items in CallbackMetadata");
        foreach ($stkCallback['CallbackMetadata']['Item'] as $item) {
            $name = $item['Name'] ?? '';
            $value = $item['Value'] ?? '';
            error_log("[C2B CALLBACK DEBUG] Metadata Item - Name: $name, Value: $value (type: " . gettype($value) . ")");

            if ($name === 'Amount') {
                $amount = floatval($value);
            } elseif ($name === 'MpesaReceiptNumber') {
                $mpesaReceiptNumber = strval($value);
            } elseif ($name === 'TransactionDate') {
                $transactionDate = strval($value);
            } elseif ($name === 'PhoneNumber') {
                $phoneNumber = strval($value);
            }
        }
    } else {
        error_log("[C2B CALLBACK DEBUG] No Item array found in CallbackMetadata");
    }
    
    // Find the STK Push session
    if ($checkoutRequestId) {
        error_log("[C2B CALLBACK] Looking for session with CheckoutRequestID: $checkoutRequestId");

        $stmt = $conn->prepare("SELECT * FROM stk_push_sessions WHERE checkout_request_id = ? LIMIT 1");

        if ($stmt) {
            $stmt->bind_param("s", $checkoutRequestId);
            $stmt->execute();
            $result = $stmt->get_result();
            $stmt->close();

            error_log("[C2B CALLBACK] Query returned " . ($result ? $result->num_rows : 0) . " rows");

            if ($result && $result->num_rows > 0) {
                $session = $result->fetch_assoc();
                
                // Determine status based on result code
                $status = 'success';
                if ($resultCode === 0 || $resultCode == 0) {
                    $status = 'success';
                } elseif ($resultCode === 1032 || $resultCode == 1032) {
                    $status = 'timeout';
                } elseif ($resultCode !== '0' && $resultCode !== 0) {
                    $status = 'failed';
                }
                
                // Update the STK session
                $updateStmt = $conn->prepare("
                    UPDATE stk_push_sessions
                    SET status = ?, result_code = ?, result_description = ?, updated_at = NOW()
                    WHERE checkout_request_id = ?
                ");

                if ($updateStmt) {
                    $updateStmt->bind_param("ssss", $status, $resultCode, $resultDesc, $checkoutRequestId);
                    $updateStmt->execute();
                    $updateStmt->close();
                    
                    logC2BEvent('session_updated', [
                        'checkout_request_id' => $checkoutRequestId,
                        'merchant_request_id' => $merchantRequestId,
                        'status' => $status,
                        'result_code' => $resultCode,
                        'amount' => $amount,
                        'phone' => $phoneNumber,
                        'receipt' => $mpesaReceiptNumber
                    ]);
                    
                    // If payment successful, record payment with trainer info and fee breakdown
                    if ($status === 'success' && $amount && $session['id']) {
                        // Fetch booking details to get trainer info and fee breakdown
                        $bookingId = $session['booking_id'];
                        $bookingStmt = $conn->prepare("
                            SELECT trainer_id, base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount
                            FROM bookings
                            WHERE id = ?
                            LIMIT 1
                        ");

                        if ($bookingStmt) {
                            $bookingStmt->bind_param("s", $bookingId);
                            $bookingStmt->execute();
                            $bookingResult = $bookingStmt->get_result();

                            if ($bookingResult && $bookingResult->num_rows > 0) {
                                $booking = $bookingResult->fetch_assoc();
                                $trainerId = $booking['trainer_id'];
                                $baseServiceAmount = floatval($booking['base_service_amount'] ?? 0);
                                $transportFee = floatval($booking['transport_fee'] ?? 0);
                                $platformFee = floatval($booking['platform_fee'] ?? 0);
                                $vatAmount = floatval($booking['vat_amount'] ?? 0);
                                $trainerNetAmount = floatval($booking['trainer_net_amount'] ?? 0);

                                // Record in payments table with trainer and fee breakdown
                                $paymentId = 'payment_' . uniqid();
                                $now = date('Y-m-d H:i:s');

                                $paymentStmt = $conn->prepare("
                                    INSERT INTO payments (
                                        id, user_id, booking_id, trainer_id, amount,
                                        base_service_amount, transport_fee, platform_fee, vat_amount, trainer_net_amount,
                                        status, method, transaction_reference, created_at, updated_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ");

                                if ($paymentStmt) {
                                    $method = 'stk';
                                    $paymentStatus = 'completed';
                                    $clientId = $session['client_id'] ?? null;

                                    $paymentStmt->bind_param(
                                        "ssssddddddsssss",
                                        $paymentId,           // id
                                        $clientId,             // user_id (client who paid)
                                        $bookingId,            // booking_id
                                        $trainerId,            // trainer_id
                                        $amount,               // amount (what client paid)
                                        $baseServiceAmount,    // base_service_amount
                                        $transportFee,         // transport_fee
                                        $platformFee,          // platform_fee
                                        $vatAmount,            // vat_amount
                                        $trainerNetAmount,     // trainer_net_amount (what trainer earns)
                                        $paymentStatus,        // status
                                        $method,               // method
                                        $mpesaReceiptNumber,   // transaction_reference
                                        $now,                  // created_at
                                        $now                   // updated_at
                                    );
                                    $paymentStmt->execute();
                                    $paymentStmt->close();

                                    logC2BEvent('payment_recorded', [
                                        'payment_id' => $paymentId,
                                        'booking_id' => $bookingId,
                                        'client_id' => $clientId,
                                        'trainer_id' => $trainerId,
                                        'amount' => $amount,
                                        'trainer_net_amount' => $trainerNetAmount,
                                        'transport_fee' => $transportFee
                                    ]);
                                }
                            } else {
                                logC2BEvent('booking_not_found', ['booking_id' => $bookingId]);
                            }
                            $bookingStmt->close();
                        }
                    } elseif (($status === 'failed' || $status === 'timeout') && $session['id']) {
                        logC2BEvent('payment_failed', [
                            'checkout_request_id' => $checkoutRequestId,
                            'status' => $status,
                            'result_code' => $resultCode,
                            'error' => $resultDesc
                        ]);
                    }
                }
            } else {
                logC2BEvent('session_not_found', ['checkout_request_id' => $checkoutRequestId]);
            }
        } else {
            logC2BEvent('prepare_error', ['error' => $conn->error]);
        }
    }
    
    // Always return 200 OK to acknowledge receipt
    // Use M-Pesa standard response format
    http_response_code(200);
    // Log response before sending
    error_log("[C2B CALLBACK RESPONSE] Sending M-Pesa standard response - ResultCode: 0, ResultDesc: Accepted");
    echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
    exit;
    
} catch (Exception $e) {
    logC2BEvent('exception', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    error_log("[C2B CALLBACK EXCEPTION] " . $e->getMessage());
    // Always return 200 OK with M-Pesa standard format even on error
    // M-Pesa needs to know we received the request
    http_response_code(200);
    error_log("[C2B CALLBACK RESPONSE] Sending M-Pesa standard response on exception - ResultCode: 0, ResultDesc: Accepted");
    echo json_encode(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
    exit;
}
?>
