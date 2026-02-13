<?php
/**
 * M-Pesa API Diagnostic and Testing Endpoint
 * 
 * Use this to test M-Pesa STK push initiation without needing the frontend
 * 
 * Access via: POST https://yourserver.com/test_mpesa_api.php
 * 
 * Example request body:
 * {
 *   "test": "credentials",
 *   "phone": "254722241745",
 *   "amount": 100
 * }
 */

header("Content-Type: application/json; charset=utf-8");

// Get request body
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true) ?? [];

$test_result = [
    "timestamp" => date('Y-m-d H:i:s'),
    "test_type" => $input['test'] ?? 'full',
    "steps" => [],
    "errors" => [],
    "success" => false
];

try {
    // Step 1: Load dependencies
    $test_result["steps"][] = [
        "name" => "Loading dependencies",
        "status" => "pending"
    ];
    
    include_once(__DIR__ . '/connection.php');
    if (!isset($conn) || !$conn) {
        throw new Exception("Database connection failed");
    }
    $test_result["steps"][0]["status"] = "✅ success";
    
    include_once(__DIR__ . '/mpesa_helper.php');
    if (!function_exists('getMpesaCredentials')) {
        throw new Exception("mpesa_helper.php not loaded correctly");
    }
    $test_result["steps"][0]["details"] = "connection.php and mpesa_helper.php loaded";
    
    // Step 2: Test credentials loading
    $test_result["steps"][] = [
        "name" => "Loading M-Pesa credentials",
        "status" => "pending"
    ];
    
    $credentials = getMpesaCredentials();
    if (!$credentials) {
        throw new Exception("M-Pesa credentials not configured in database or environment");
    }
    
    $test_result["steps"][1]["status"] = "✅ success";
    $test_result["steps"][1]["details"] = [
        "source" => $credentials['source'] ?? 'unknown',
        "environment" => $credentials['environment'] ?? 'unknown',
        "has_consumer_key" => !empty($credentials['consumer_key']),
        "has_consumer_secret" => !empty($credentials['consumer_secret']),
        "has_shortcode" => !empty($credentials['shortcode']),
        "has_passkey" => !empty($credentials['passkey'])
    ];
    
    // Validate credentials completeness
    $required_fields = ['consumer_key', 'consumer_secret', 'shortcode', 'passkey'];
    $missing_fields = [];
    foreach ($required_fields as $field) {
        if (empty($credentials[$field])) {
            $missing_fields[] = $field;
        }
    }
    
    if (!empty($missing_fields)) {
        throw new Exception("Missing required credential fields: " . implode(", ", $missing_fields));
    }
    
    // Step 3: Test access token retrieval
    $test_result["steps"][] = [
        "name" => "Retrieving M-Pesa access token",
        "status" => "pending"
    ];
    
    $access_token = getMpesaAccessToken($credentials);
    if (!$access_token) {
        throw new Exception("Failed to obtain M-Pesa access token. Check credentials or network connectivity.");
    }
    
    $test_result["steps"][2]["status"] = "✅ success";
    $test_result["steps"][2]["details"] = [
        "token_length" => strlen($access_token) . " characters",
        "token_preview" => substr($access_token, 0, 10) . "..." . substr($access_token, -5),
        "environment" => $credentials['environment'] ?? 'unknown'
    ];
    
    // Step 4: Test STK push initiation (if test data provided)
    if ($input['test'] !== 'credentials' && (!empty($input['phone']) && !empty($input['amount']))) {
        $test_result["steps"][] = [
            "name" => "Testing STK Push initiation",
            "status" => "pending",
            "input" => [
                "phone" => substr($input['phone'], -9),
                "amount" => $input['amount'],
                "account_reference" => $input['account_reference'] ?? 'test_' . time()
            ]
        ];
        
        $phone = $input['phone'];
        $amount = intval($input['amount']);
        $account_reference = $input['account_reference'] ?? 'test_' . time();
        
        $stk_result = initiateSTKPush($credentials, $phone, $amount, $account_reference);
        
        if (!$stk_result['success']) {
            throw new Exception("STK push initiation failed: " . ($stk_result['error'] ?? 'Unknown error'));
        }
        
        $test_result["steps"][3]["status"] = "✅ success";
        $test_result["steps"][3]["details"] = [
            "checkout_request_id" => $stk_result['checkout_request_id'] ?? 'N/A',
            "merchant_request_id" => $stk_result['merchant_request_id'] ?? 'N/A',
            "response_code" => $stk_result['response_code'] ?? 'N/A',
            "response_description" => $stk_result['response_description'] ?? 'N/A'
        ];
        
        // Step 5: Save test session to database
        if (!empty($stk_result['checkout_request_id'])) {
            $test_result["steps"][] = [
                "name" => "Saving STK session to database",
                "status" => "pending"
            ];
            
            // Ensure table exists
            $tableCheck = @$conn->query("SHOW TABLES LIKE 'stk_push_sessions'");
            if (!$tableCheck || $tableCheck->num_rows === 0) {
                $createTableSql = "
                    CREATE TABLE IF NOT EXISTS stk_push_sessions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        checkout_request_id VARCHAR(255) UNIQUE NOT NULL,
                        booking_id VARCHAR(255),
                        client_id VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'pending',
                        result_code VARCHAR(50),
                        result_description TEXT,
                        merchant_request_id VARCHAR(255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_checkout (checkout_request_id),
                        INDEX idx_booking (booking_id),
                        INDEX idx_client (client_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ";
                @$conn->query($createTableSql);
            }
            
            // Insert session
            $insertStmt = $conn->prepare("INSERT INTO stk_push_sessions (checkout_request_id, status) VALUES (?, 'pending_test')");
            if ($insertStmt) {
                $checkoutId = $stk_result['checkout_request_id'];
                $insertStmt->bind_param("s", $checkoutId);
                if ($insertStmt->execute()) {
                    $test_result["steps"][4]["status"] = "✅ success";
                    $test_result["steps"][4]["details"] = [
                        "rows_affected" => $insertStmt->affected_rows,
                        "note" => "Test session saved. Check c2b_callbacks.log for callback status."
                    ];
                } else {
                    $test_result["steps"][4]["status"] = "⚠️ warning";
                    $test_result["steps"][4]["details"] = [
                        "error" => $insertStmt->error,
                        "note" => "Session save failed but STK push was initiated. Phone should still receive prompt."
                    ];
                }
                $insertStmt->close();
            }
        }
    }
    
    $test_result["success"] = true;
    $test_result["status"] = "✅ All tests passed";
    http_response_code(200);
    
} catch (Exception $e) {
    $test_result["success"] = false;
    $test_result["status"] = "❌ Test failed";
    $test_result["errors"][] = $e->getMessage();
    
    // Mark the last pending step as failed
    if (!empty($test_result["steps"])) {
        $lastStep = count($test_result["steps"]) - 1;
        if ($test_result["steps"][$lastStep]["status"] === "pending") {
            $test_result["steps"][$lastStep]["status"] = "❌ failed";
            $test_result["steps"][$lastStep]["error"] = $e->getMessage();
        }
    }
    
    http_response_code(500);
}

// Close database connection
if (isset($conn)) {
    $conn->close();
}

echo json_encode($test_result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
