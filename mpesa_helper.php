<?php
/**
 * M-Pesa Helper Functions
 * 
 * Handles server-side credential management and M-Pesa API integration
 * Credentials are retrieved from admin settings (database), not from client requests
 * Environment variables used only as fallback
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
            return [
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
        return $envCreds;
    }
    
    return null;
}

// Validate that M-Pesa credentials are configured
function validateMpesaCredentialsConfigured() {
    $creds = getMpesaCredentials();
    if (!$creds || empty($creds['consumer_key']) || empty($creds['consumer_secret'])) {
        return [
            'valid' => false,
            'error' => 'M-Pesa credentials not configured. Please configure in admin settings.',
            'source' => null
        ];
    }
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

    // Log token request details
    error_log("[MPESA TOKEN REQUEST] Environment: $environment, URL: $token_url, Key: " . substr($consumer_key, 0, 4) . "...");

    $auth_string = base64_encode($consumer_key . ':' . $consumer_secret);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $token_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Basic ' . $auth_string]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Log response
    error_log("[MPESA TOKEN RESPONSE] HTTP $http_code, Response: " . substr($response, 0, 500));

    if ($http_code !== 200) {
        error_log("[MPESA TOKEN ERROR] HTTP $http_code - $response");
        return null;
    }

    $token_response = json_decode($response, true);
    $access_token = $token_response['access_token'] ?? null;

    if ($access_token) {
        error_log("[MPESA TOKEN SUCCESS] Token obtained: " . substr($access_token, 0, 20) . "..." . substr($access_token, -10));
    }

    return $access_token;
}

// Initiate STK Push payment
function initiateSTKPush($credentials, $phone, $amount, $account_reference, $callback_url = null) {
    error_log("[STK PUSH INIT] Starting STK push initiation");
    error_log("[STK PUSH INIT] Phone: $phone, Amount: $amount, Reference: $account_reference");

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

    error_log("[STK PUSH INIT] Access token obtained, Shortcode: $shortcode, Environment: $environment");

    // Use default C2B callback URL if not provided (for STK Push payments)
    if (empty($callback_url)) {
        $callback_url = 'https://trainercoachconnect.com/c2b_callback.php';
    }

    error_log("[STK PUSH INIT] Callback URL: $callback_url");

    $stk_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    error_log("[STK PUSH REQUEST] URL: $stk_url");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

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

    error_log("[STK PUSH PAYLOAD] " . json_encode($payload));
    error_log("[STK PUSH AUTH] Using access token: " . substr($access_token, 0, 20) . "..." . substr($access_token, -10));

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
    curl_close($ch);

    error_log("[STK PUSH RESPONSE] HTTP $http_code, Body: " . substr($response, 0, 1000));

    $response_data = json_decode($response, true);

    if ($http_code !== 200 || empty($response_data['CheckoutRequestID'])) {
        error_log("[STK PUSH FAIL] HTTP $http_code - " . json_encode($response_data));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? 'Failed to initiate STK Push'
        ];
    }

    error_log("[STK PUSH SUCCESS] CheckoutRequestID: " . $response_data['CheckoutRequestID'] . ", MerchantRequestID: " . $response_data['MerchantRequestID'] . ", ResponseCode: " . $response_data['ResponseCode']);

    return [
        'success' => true,
        'checkout_request_id' => $response_data['CheckoutRequestID'],
        'merchant_request_id' => $response_data['MerchantRequestID'],
        'response_code' => $response_data['ResponseCode'],
        'response_description' => $response_data['ResponseDescription']
    ];
}

// Query STK Push status
function querySTKPushStatus($credentials, $checkout_request_id) {
    error_log("[STK QUERY] Starting query for CheckoutRequestID: $checkout_request_id");

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

    error_log("[STK QUERY REQUEST] URL: $query_url, Environment: $environment");

    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);

    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'CheckoutRequestID' => $checkout_request_id
    ];

    error_log("[STK QUERY PAYLOAD] " . json_encode($payload));
    error_log("[STK QUERY AUTH] Using access token: " . substr($access_token, 0, 20) . "..." . substr($access_token, -10));

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
    curl_close($ch);

    error_log("[STK QUERY RESPONSE] HTTP $http_code, Body: " . substr($response, 0, 1000));

    $response_data = json_decode($response, true);

    if ($http_code !== 200) {
        error_log("[STK QUERY FAIL] HTTP $http_code - " . json_encode($response_data));
        return [
            'success' => false,
            'error' => 'Failed to query STK Push status'
        ];
    }

    error_log("[STK QUERY SUCCESS] ResultCode: " . ($response_data['ResultCode'] ?? 'N/A') . ", ResultDesc: " . ($response_data['ResultDesc'] ?? 'N/A'));

    return [
        'success' => true,
        'result_code' => $response_data['ResultCode'],
        'result_description' => $response_data['ResultDesc'],
        'merchant_request_id' => $response_data['MerchantRequestID'],
        'checkout_request_id' => $response_data['CheckoutRequestID']
    ];
}

// Initiate B2C payment (payout)
function initiateB2CPayment($credentials, $phone, $amount, $command_id = null, $remarks = null, $queue_timeout_url = null, $result_url = null) {
    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $initiator_name = $credentials['initiator_name'];
    $security_credential = $credentials['security_credential'];

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
    curl_close($ch);
    
    $response_data = json_decode($response, true);
    
    if ($http_code !== 200 || empty($response_data['ConversationID'])) {
        error_log("B2C error: HTTP $http_code - " . json_encode($response_data));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? 'Failed to initiate B2C payment'
        ];
    }
    
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
        error_log("Failed to create platform_settings table: " . $conn->error);
        return false;
    }
    
    $creds_json = json_encode($credentials);
    
    $sql = "
        INSERT INTO platform_settings (setting_key, value) 
        VALUES ('mpesa_credentials', ?)
        ON DUPLICATE KEY UPDATE 
            value = VALUES(value),
            updated_at = CURRENT_TIMESTAMP
    ";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log("Prepare failed: " . $conn->error);
        return false;
    }
    
    $stmt->bind_param("s", $creds_json);
    $result = $stmt->execute();
    $stmt->close();
    
    if (!$result) {
        error_log("Execute failed: " . $conn->error);
        return false;
    }
    
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
