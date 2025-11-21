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
                'consumer_key' => $settings['consumerKey'],
                'consumer_secret' => $settings['consumerSecret'],
                'shortcode' => $settings['shortcode'] ?? '',
                'passkey' => $settings['passkey'] ?? '',
                'environment' => $settings['environment'] ?? 'sandbox',
                'result_url' => $settings['resultUrl'] ?? '',
                'initiator_name' => $settings['initiatorName'] ?? '',
                'security_credential' => $settings['securityCredential'] ?? '',
                'source' => 'admin_settings'
            ];
        }
    }
    
    // Fallback to environment variables
    $envCreds = [
        'consumer_key' => getenv('MPESA_CONSUMER_KEY'),
        'consumer_secret' => getenv('MPESA_CONSUMER_SECRET'),
        'shortcode' => getenv('MPESA_SHORTCODE'),
        'passkey' => getenv('MPESA_PASSKEY'),
        'environment' => getenv('MPESA_ENVIRONMENT') ?? 'sandbox',
        'result_url' => getenv('MPESA_RESULT_URL'),
        'initiator_name' => getenv('MPESA_INITIATOR_NAME') ?? '',
        'security_credential' => getenv('MPESA_SECURITY_CREDENTIAL') ?? '',
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
    
    if ($http_code !== 200) {
        error_log("M-Pesa token error: HTTP $http_code - $response");
        return null;
    }
    
    $token_response = json_decode($response, true);
    return $token_response['access_token'] ?? null;
}

// Initiate STK Push payment
function initiateSTKPush($credentials, $phone, $amount, $account_reference, $callback_url = null) {
    $access_token = getMpesaAccessToken($credentials);

    if (!$access_token) {
        return [
            'success' => false,
            'error' => 'Failed to obtain M-Pesa access token'
        ];
    }

    $environment = $credentials['environment'] ?? 'sandbox';
    $shortcode = $credentials['shortcode'];
    $passkey = $credentials['passkey'];

    // Use default C2B callback URL if not provided
    if (empty($callback_url)) {
        $callback_url = 'https://trainer.skatryk.co.ke/c2b_callback.php';
    }

    $stk_url = ($environment === 'production')
        ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

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
    
    $response_data = json_decode($response, true);
    
    if ($http_code !== 200 || empty($response_data['CheckoutRequestID'])) {
        error_log("STK Push error: HTTP $http_code - " . json_encode($response_data));
        return [
            'success' => false,
            'error' => $response_data['errorMessage'] ?? 'Failed to initiate STK Push'
        ];
    }
    
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
    $access_token = getMpesaAccessToken($credentials);
    
    if (!$access_token) {
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
    
    $timestamp = date('YmdHis');
    $password = base64_encode($shortcode . $passkey . $timestamp);
    
    $payload = [
        'BusinessShortCode' => $shortcode,
        'Password' => $password,
        'Timestamp' => $timestamp,
        'CheckoutRequestID' => $checkout_request_id
    ];
    
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
    
    $response_data = json_decode($response, true);
    
    if ($http_code !== 200) {
        error_log("STK Query error: HTTP $http_code - " . json_encode($response_data));
        return [
            'success' => false,
            'error' => 'Failed to query STK Push status'
        ];
    }
    
    return [
        'success' => true,
        'result_code' => $response_data['ResultCode'],
        'result_description' => $response_data['ResultDesc'],
        'merchant_request_id' => $response_data['MerchantRequestID'],
        'checkout_request_id' => $response_data['CheckoutRequestID']
    ];
}

// Initiate B2C payment (payout)
function initiateB2CPayment($credentials, $phone, $amount, $command_id, $remarks, $queue_timeout_url, $result_url) {
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
        'Remarks' => $remarks ?? 'Payment',
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
