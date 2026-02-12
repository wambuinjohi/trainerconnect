<?php
/**
 * M-Pesa Helper Functions - ENHANCED WITH DETAILED LOGGING
 * 
 * Handles server-side credential management and M-Pesa API integration
 * Credentials are retrieved from admin settings (database), not from client requests
 * Environment variables used only as fallback
 * 
 * ENHANCED: Detailed logging of all M-Pesa API calls and responses
 */

// Get M-Pesa credentials from admin settings or environment
function getMpesaCredentials() {
    global $conn;
    
    // Try to get from admin settings table first
    $sql = "SELECT value FROM platform_settings WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $settings = json_decode($row['value'], true);
        if ($settings && !empty($settings['consumerKey']) && !empty($settings['consumerSecret'])) {
            $creds = [
                'consumer_key' => trim($settings['consumerKey']),
                'consumer_secret' => trim($settings['consumerSecret']),
                'shortcode' => trim($settings['shortcode'] ?? ''),
                'passkey' => trim($settings['passkey'] ?? ''),
                'environment' => trim($settings['environment'] ?? 'sandbox'),
                'result_url' => trim($settings['resultUrl'] ?? ''),
                'initiator_name' => trim($settings['initiatorName'] ?? ''),
                'security_credential' => trim($settings['securityCredential'] ?? ''),
                'c2b_callback_url' => trim($settings['c2bCallbackUrl'] ?? ''),
                'b2c_callback_url' => trim($settings['b2cCallbackUrl'] ?? ''),
                'source' => 'admin_settings'
            ];
            error_log("[MPESA CREDS] Loaded from database. Environment: " . $creds['environment'] . ", Source: admin_settings");
            return $creds;
        }
    }
    
    // Fallback to environment variables
    $envCreds = [
        'consumer_key' => trim(getenv('MPESA_CONSUMER_KEY') ?: ''),
        'consumer_secret' => trim(getenv('MPESA_CONSUMER_SECRET') ?: ''),
        'shortcode' => trim(getenv('MPESA_SHORTCODE') ?: ''),
        'passkey' => trim(getenv('MPESA_PASSKEY') ?: ''),
        'environment' => trim(getenv('MPESA_ENVIRONMENT') ?: 'sandbox'),
        'result_url' => trim(getenv('MPESA_RESULT_URL') ?: ''),
        'initiator_name' => trim(getenv('MPESA_INITIATOR_NAME') ?: ''),
        'security_credential' => trim(getenv('MPESA_SECURITY_CREDENTIAL') ?: ''),
        'c2b_callback_url' => trim(getenv('MPESA_C2B_CALLBACK_URL') ?: ''),
        'b2c_callback_url' => trim(getenv('MPESA_B2C_CALLBACK_URL') ?: ''),
        'source' => 'environment'
    ];
    
    // Only return env credentials if all required fields are present
    if (!empty($envCreds['consumer_key']) && !empty($envCreds['consumer_secret'])) {
        error_log("[MPESA CREDS] Loaded from environment variables. Environment: " . $envCreds['environment']);
        return $envCreds;
    }
    
    error_log("[MPESA CREDS ERROR] No valid credentials found in database or environment");
    return null;
}

// Validate that M-Pesa credentials are configured
function validateMpesaCredentialsConfigured() {
    $creds = getMpesaCredentials();
    if (!$creds || empty($creds['consumer_key']) || empty($creds['consumer_secret'])) {
        error_log("[MPESA VALIDATION] FAILED - Credentials not found or incomplete");
        return [
            'valid' => false,
            'error' => 'M-Pesa credentials not configured. Please configure in admin settings.',
            'source' => null
        ];
    }
    error_log("[MPESA VALIDATION] SUCCESS - Source: " . $creds['source'] . ", Environment: " . $creds['environment']);
    return [
        'valid' => true,
        'source' => $creds['source'],
        'environment' => $creds['environment'] ?? 'sandbox'
    ];
}

// Get M-Pesa access token
function getMpesaAccessToken($credentials) {
    $consumer_key = $credentials['consumer_key'];
    $consumer_secret = $credentials['consumer_secret'];
    $environment = $credentials['environment'] ?? 'sandbox';

    $token_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

    error_log("[MPESA TOKEN REQUEST] Starting token request");
    error_log("[MPESA TOKEN REQUEST] Environment: $environment");
    error_log("[MPESA TOKEN REQUEST] URL: $token_url");
    error_log("[MPESA TOKEN REQUEST] Consumer Key: " . substr($consumer_key, 0, 10) . "..." . substr($consumer_key, -5));

    $auth_string = base64_encode($consumer_key . ':' . $consumer_secret);
    error_log("[MPESA TOKEN REQUEST] Auth String (base64): " . substr($auth_string, 0, 20) . "...");

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . $auth_string]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);
    curl_close($ch);

    error_log("[MPESA TOKEN RESPONSE] HTTP Code: $http_code");
    error_log("[MPESA TOKEN RESPONSE] Full Response: " . $response);
    
    if ($curl_error) {
        error_log("[MPESA TOKEN ERROR] CURL Error [$curl_errno]: $curl_error");
    }

    if ($http_code !== 200) {
        error_log("[MPESA TOKEN ERROR] Token request failed with HTTP $http_code");
        error_log("[MPESA TOKEN ERROR] Response Details: " . json_encode(json_decode($response, true), JSON_PRETTY_PRINT));
        return null;
    }

    $token_response = json_decode($response, true);
    
    if (!$token_response) {
        error_log("[MPESA TOKEN ERROR] Failed to decode JSON response");
        return null;
    }
    
    $access_token = $token_response['access_token'] ?? null;
    $expires_in = $token_response['expires_in'] ?? null;

    if ($access_token) {
        error_log("[MPESA TOKEN SUCCESS] Token obtained successfully");
        error_log("[MPESA TOKEN SUCCESS] Token: " . substr($access_token, 0, 30) . "..." . substr($access_token, -10));
        error_log("[MPESA TOKEN SUCCESS] Expires in: $expires_in seconds");
    } else {
        error_log("[MPESA TOKEN ERROR] No access_token in response. Full response: " . json_encode($token_response, JSON_PRETTY_PRINT));
    }

    return $access_token;
}

// Initiate STK Push payment
function initiateSTKPush($credentials, $phone, $amount, $account_reference, $callback_url = null) {
    error_log("[STK PUSH INIT] ========== STARTING STK PUSH INITIATION ==========");
    error_log("[STK PUSH INIT] Raw Phone Input: $phone");

    // Validate phone format (should be 254XXXXXXXXX)
    $phonePattern = '/^254[0-9]{9}$/';
    if (!preg_match($phonePattern, $phone)) {
        error_log("[STK PUSH ERROR] Phone number format invalid: $phone. Expected format: 254XXXXXXXXX (11 digits starting with 254)");
    } else {
        error_log("[STK PUSH INIT] Phone format valid: $phone");
    }

    error_log("[STK PUSH INIT] Amount: $amount");
    error_log("[STK PUSH INIT] Account Reference: $account_reference");

    // Validate credentials
    if (!$credentials) {
        error_log("[STK PUSH ERROR] No credentials provided");
        return [
            'success' => false,
            'error' => 'M-Pesa credentials not available'
        ];
    }

    if (empty($credentials['shortcode']) || empty($credentials['passkey'])) {
        error_log("[STK PUSH ERROR] Missing required fields - Shortcode: " . ($credentials['shortcode'] ?? 'MISSING') . ", Passkey: " . ($credentials['passkey'] ?? 'MISSING'));
        return [
            'success' => false,
            'error' => 'M-Pesa shortcode or passkey not configured'
        ];
    }

    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[STK PUSH ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];

    error_log("[STK PUSH INIT] Access token obtained successfully");
    error_log("[STK PUSH INIT] Shortcode: $shortcode");
    error_log("[STK PUSH INIT] Environment: $environment");

    // Use default C2B callback URL if not provided (for STK Push payments)
    if (empty($callback_url)) {
        $callback_url = 'https://trainercoachconnect.com/c2b_callback.php';
    }

    error_log("[STK PUSH INIT] Callback URL: $callback_url");

    $stk_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    error_log("[STK PUSH REQUEST] STK Push URL: $stk_url");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

    error_log("[STK PUSH REQUEST] Timestamp: $timestamp");
    error_log("[STK PUSH REQUEST] Password (base64): " . substr($password, 0, 20) . "...");

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'TransactionType' => 'CustomerPayBillOnline',
        'Amount' => intval($amount),
        'PartyA' => $phone,
        'PartyB' => $shortcode,
        'PhoneNumber' => $phone,
        'CallBackURL' => $callback_url,
        'AccountReference' => $account_reference,
        'TransactionDesc' => 'Payment for service'
    ];

    error_log("[STK PUSH PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $stk_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);
    curl_close($ch);

    error_log("[STK PUSH RESPONSE] HTTP Code: $http_code");
    error_log("[STK PUSH RESPONSE] Full Response Body: " . $response);
    
    if ($curl_error) {
        error_log("[STK PUSH CURL ERROR] [$curl_errno]: $curl_error");
    }

    $response_data = json_decode($response, true);

    if (!$response_data) {
        error_log("[STK PUSH ERROR] Failed to decode JSON response");
        return [
            'success' => false,
            'error' => 'Invalid response from M-Pesa API'
        ];
    }

    error_log("[STK PUSH RESPONSE DATA] " . json_encode($response_data, JSON_PRETTY_PRINT));

    if ($http_code !== 200) {
        error_log("[STK PUSH FAIL] HTTP $http_code - M-Pesa API rejected request");
        error_log("[STK PUSH FAIL] Error Details: " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? $response_data['message'] ?? 'Failed to initiate STK Push'
        ];
    }

    if (empty($response_data['CheckoutRequestID'])) {
        error_log("[STK PUSH FAIL] HTTP 200 but no CheckoutRequestID in response");
        error_log("[STK PUSH FAIL] Response: " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => 'M-Pesa did not return CheckoutRequestID'
        ];
    }

    error_log("[STK PUSH SUCCESS] ========== STK PUSH INITIATED SUCCESSFULLY ==========");
    error_log("[STK PUSH SUCCESS] CheckoutRequestID: " . $response_data['CheckoutRequestID']);
    error_log("[STK PUSH SUCCESS] MerchantRequestID: " . ($response_data['MerchantRequestID'] ?? 'N/A'));
    error_log("[STK PUSH SUCCESS] ResponseCode: " . ($response_data['ResponseCode'] ?? 'N/A'));
    error_log("[STK PUSH SUCCESS] ResponseDescription: " . ($response_data['ResponseDescription'] ?? 'N/A'));

    return [
        'success' => true,
        'checkout_request_id' => $response_data['CheckoutRequestID'],
        'merchant_request_id' => $response_data['MerchantRequestID'] ?? null,
        'response_code' => $response_data['ResponseCode'] ?? null,
        'response_description' => $response_data['ResponseDescription'] ?? null
    ];
}

// Query STK Push status
function querySTKPushStatus($credentials, $checkout_request_id) {
    error_log("[STK QUERY] ========== STARTING STK QUERY ==========");
    error_log("[STK QUERY] CheckoutRequestID: $checkout_request_id");

    if (!$credentials) {
        error_log("[STK QUERY ERROR] No credentials provided");
        return [
            'success' => false,
            'error' => 'M-Pesa credentials not available'
        ];
    }

    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[STK QUERY ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }
    
    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];

    $query_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    error_log("[STK QUERY REQUEST] URL: $query_url");
    error_log("[STK QUERY REQUEST] Environment: $environment");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'CheckoutRequestID' => $checkout_request_id
    ];

    error_log("[STK QUERY PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $query_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    $curl_errno = curl_errno($ch);
    curl_close($ch);

    error_log("[STK QUERY RESPONSE] HTTP Code: $http_code");
    error_log("[STK QUERY RESPONSE] Full Response: " . $response);
    
    if ($curl_error) {
        error_log("[STK QUERY CURL ERROR] [$curl_errno]: $curl_error");
    }

    $response_data = json_decode($response, true);

    if (!$response_data) {
        error_log("[STK QUERY ERROR] Failed to decode JSON response");
        return [
            'success' => false,
            'error' => 'Invalid response from M-Pesa API'
        ];
    }

    error_log("[STK QUERY RESPONSE DATA] " . json_encode($response_data, JSON_PRETTY_PRINT));

    if ($http_code !== 200) {
        error_log("[STK QUERY FAIL] HTTP $http_code - " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => 'Failed to query STK Push status'
        ];
    }

    error_log("[STK QUERY SUCCESS] ResultCode: " . ($response_data['ResultCode'] ?? 'N/A'));
    error_log("[STK QUERY SUCCESS] ResultDesc: " . ($response_data['ResultDesc'] ?? 'N/A'));

    return [
        'success' => true,
        'result_code' => $response_data['ResultCode'],
        'result_description' => $response_data['ResultDesc'],
        'merchant_request_id' => $response_data['MerchantRequestID'] ?? null,
        'checkout_request_id' => $response_data['CheckoutRequestID'] ?? null
    ];
}

// Initiate B2C payment (payout)
function initiateB2CPayment($credentials, $phone, $amount, $command_id = null, $remarks = null, $queue_timeout_url = null, $result_url = null) {
    error_log("[B2C INIT] Starting B2C payment - Phone: $phone, Amount: $amount");
    
    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        error_log("[B2C ERROR] Failed to obtain access token");
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $initiator_name = $credentials['initiator_name'];
    $security_credential = $credentials['security_credential'];

    error_log("[B2C REQUEST] Environment: $environment, Shortcode: $shortcode, InitiatorName: $initiator_name");

    // Use default B2C callback URLs if not provided (for payouts)
    if (empty($queue_timeout_url)) {
        $queue_timeout_url = 'https://trainercoachconnect.com/b2c_callback.php';
    }
    if (empty($result_url)) {
        $result_url = 'https://trainercoachconnect.com/b2c_callback.php';
    }

    $b2c_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest';

    error_log("[B2C REQUEST] URL: $b2c_url");

    $payload = [
        'InitiatorName' => $initiator_name,
        'SecurityCredential' => $security_credential,
        'CommandID' => $command_id ?? 'BusinessPayment',
        'Amount' => intval($amount),
        'PartyA' => $shortcode,
        'PartyB' => $phone,
        'Remarks' => $remarks ?? 'Payout',
        'QueueTimeOutURL' => $queue_timeout_url,
        'ResultURL' => $result_url
    ];

    error_log("[B2C PAYLOAD] " . json_encode($payload, JSON_PRETTY_PRINT));
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $b2c_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $access_token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);
    
    error_log("[B2C RESPONSE] HTTP Code: $http_code");
    error_log("[B2C RESPONSE] Full Response: " . $response);
    
    if ($curl_error) {
        error_log("[B2C CURL ERROR] $curl_error");
    }
    
    $response_data = json_decode($response, true);
    
    if ($http_code !== 200 || empty($response_data['ConversationID'])) {
        error_log("[B2C ERROR] HTTP $http_code - " . json_encode($response_data, JSON_PRETTY_PRINT));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? 'Failed to initiate B2C payment'
        ];
    }
    
    error_log("[B2C SUCCESS] ConversationID: " . $response_data['ConversationID']);
    
    return [
        'success' => true,
        'conversation_id' => $response_data['ConversationID'],
        'originator_conversation_id' => $response_data['OriginatorConversationID'],
        'response_code' => $response_data['ResponseCode'],
        'response_description' => $response_data['ResponseDescription']
    ];
}

// Save M-Pesa credentials to admin settings
function saveMpesaCredentials($credentials) {
    global $conn;
    
    error_log("[MPESA SAVE] Saving credentials to database");
    
    // Ensure platform_settings table exists
    $create_table_sql = "
        CREATE TABLE IF NOT EXISTS platform_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(255) UNIQUE NOT NULL,
            value LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ";
    
    if (!$conn->query($create_table_sql)) {
        error_log("[MPESA SAVE ERROR] Failed to create platform_settings table: " . $conn->error);
        return false;
    }
    
    $creds_json = json_encode($credentials);
    error_log("[MPESA SAVE] Credentials JSON: " . $creds_json);
    
    $sql = "
        INSERT INTO platform_settings (setting_key, value) 
        VALUES ('mpesa_credentials', ?)
        ON DUPLICATE KEY UPDATE 
            value = VALUES(value),
            updated_at = CURRENT_TIMESTAMP
    ";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("[MPESA SAVE ERROR] Prepare failed: " . $conn->error);
        return false;
    }
    
    $stmt->bind_param("s", $creds_json);
    $result = $stmt->execute();
    $stmt->close();
    
    if (!$result) {
        error_log("[MPESA SAVE ERROR] Execute failed: " . $conn->error);
        return false;
    }
    
    error_log("[MPESA SAVE SUCCESS] Credentials saved successfully");
    
    // Log credential change
    logEvent('mpesa_credentials_updated', [
        'source' => 'admin_settings',
        'environment' => $credentials['environment'] ?? 'unknown'
    ]);
    
    return true;
}

// Get M-Pesa credentials (for admin use only)
function getMpesaCredentialsForAdmin() {
    $creds = getMpesaCredentials();
    if (!$creds) {
        return null;
    }

    // Return with masked secrets for display
    return [
        'environment' => $creds['environment'],
        'consumerKey' => maskSecret($creds['consumer_key']),
        'consumerSecret' => maskSecret($creds['consumer_secret']),
        'shortcode' => $creds['shortcode'],
        'passkey' => maskSecret($creds['passkey']),
        'resultUrl' => $creds['result_url'],
        'initiatorName' => $creds['initiator_name'],
        'securityCredential' => maskSecret($creds['security_credential']),
        'c2bCallbackUrl' => $creds['c2b_callback_url'] ?? '',
        'b2cCallbackUrl' => $creds['b2c_callback_url'] ?? '',
        'source' => $creds['source']
    ];
}

// Mask secrets for display (show only first and last 3 chars)
function maskSecret($secret) {
    if (empty($secret) || strlen($secret) < 8) {
        return '••••••••';
    }
    $visible = strlen($secret) <= 6 ? 3 : 3;
    return substr($secret, 0, $visible) . '...' . substr($secret, -3);
}

// Log payment event
function logPaymentEvent($action, $details = []) {
    logEvent('mpesa_' . $action, array_merge($details, [
        'timestamp' => date('Y-m-d H:i:s'),
        'php_pid' => getmypid()
    ]));
}
?>
