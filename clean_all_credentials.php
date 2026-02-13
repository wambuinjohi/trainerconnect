<?php
/**
 * Clean All M-Pesa Credentials
 * 
 * Removes leading/trailing spaces from ALL M-Pesa credential fields:
 * - consumerKey
 * - consumerSecret
 * - shortcode
 * - passkey
 * - initiatorName
 * - resultUrl
 * - c2bCallbackUrl
 * - b2cCallbackUrl
 * 
 * Access via: https://your-domain.com/clean_all_credentials.php
 */

header("Content-Type: application/json; charset=utf-8");

$result = [
    "timestamp" => date('Y-m-d H:i:s'),
    "action" => "Clean all M-Pesa credentials",
    "changes_made" => [],
    "success" => false,
    "message" => "",
    "errors" => []
];

try {
    // Load database connection
    include_once(__DIR__ . '/connection.php');
    
    if (!isset($conn) || !$conn) {
        throw new Exception("Database connection failed");
    }
    
    error_log("[CREDS CLEAN] Starting comprehensive credential cleaning");
    
    // Step 1: Get current credentials
    $sql = "SELECT value FROM platform_settings WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    $queryResult = $conn->query($sql);
    
    if (!$queryResult || $queryResult->num_rows === 0) {
        throw new Exception("M-Pesa credentials not found in database");
    }
    
    $row = $queryResult->fetch_assoc();
    $credentials = json_decode($row['value'], true);
    
    if (!$credentials) {
        throw new Exception("Could not parse M-Pesa credentials JSON");
    }
    
    // Step 2: Define fields to clean
    $fieldsToClean = [
        'consumerKey',
        'consumerSecret',
        'shortcode',
        'passkey',
        'initiatorName',
        'resultUrl',
        'c2bCallbackUrl',
        'b2cCallbackUrl'
    ];
    
    // Step 3: Clean each field
    $anyChanged = false;
    foreach ($fieldsToClean as $field) {
        if (isset($credentials[$field]) && is_string($credentials[$field])) {
            $original = $credentials[$field];
            $cleaned = trim($credentials[$field]);
            
            if ($original !== $cleaned) {
                $anyChanged = true;
                
                // Hide sensitive values in logs
                $displayOriginal = strlen($original) > 20 ? substr($original, 0, 5) . "...[TRIMMED]..." : $original;
                $displayCleaned = strlen($cleaned) > 20 ? substr($cleaned, 0, 5) . "...[CLEAN]..." : $cleaned;
                
                error_log("[CREDS CLEAN] Field '{$field}' trimmed: '{$displayOriginal}' → '{$displayCleaned}'");
                
                $result["changes_made"][] = [
                    "field" => $field,
                    "original_length" => strlen($original),
                    "cleaned_length" => strlen($cleaned),
                    "had_leading_space" => $original !== ltrim($original),
                    "had_trailing_space" => $original !== rtrim($original),
                    "status" => "TRIMMED"
                ];
                
                $credentials[$field] = $cleaned;
            } else {
                $result["changes_made"][] = [
                    "field" => $field,
                    "length" => strlen($original),
                    "status" => "CLEAN"
                ];
            }
        }
    }
    
    // Step 4: Update database if changes were made
    if ($anyChanged) {
        $updatedJson = json_encode($credentials);
        
        $updateSql = "UPDATE platform_settings SET value = ? WHERE setting_key = 'mpesa_credentials'";
        $stmt = $conn->prepare($updateSql);
        
        if (!$stmt) {
            throw new Exception("Database prepare failed: " . $conn->error);
        }
        
        $stmt->bind_param("s", $updatedJson);
        
        if (!$stmt->execute()) {
            throw new Exception("Database update failed: " . $stmt->error);
        }
        
        $stmt->close();
        
        error_log("[CREDS CLEAN] Database updated successfully");
        
        $result["success"] = true;
        $result["message"] = "✅ Credentials cleaned successfully! " . count(array_filter($result["changes_made"], fn($c) => $c["status"] === "TRIMMED")) . " fields were trimmed.";
    } else {
        $result["success"] = true;
        $result["message"] = "✅ All credentials are already clean - no spaces found!";
    }
    
    $result["next_steps"] = [
        "1. Test M-Pesa token request: https://your-domain.com/test_mpesa_api.php",
        "2. Make a test booking payment",
        "3. Verify M-Pesa prompt appears",
        "4. Check logs for [MPESA TOKEN SUCCESS]"
    ];
    
    http_response_code(200);
    
} catch (Exception $e) {
    $result["success"] = false;
    $result["message"] = "❌ Error: " . $e->getMessage();
    $result["errors"][] = $e->getMessage();
    error_log("[CREDS CLEAN ERROR] " . $e->getMessage());
    http_response_code(500);
}

// Close database connection
if (isset($conn)) {
    $conn->close();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
