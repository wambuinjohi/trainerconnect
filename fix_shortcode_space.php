<?php
/**
 * Fix M-Pesa Shortcode Leading Space Issue
 * 
 * Your shortcode is stored as " 9512956" (with leading space)
 * This causes M-Pesa to reject it with error: "Bad Request - Kindly use your own ShortCode"
 * 
 * This script removes the leading/trailing spaces from the shortcode
 * 
 * Access via: https://your-domain.com/fix_shortcode_space.php
 */

header("Content-Type: application/json; charset=utf-8");

$result = [
    "timestamp" => date('Y-m-d H:i:s'),
    "action" => "Fix M-Pesa shortcode leading space",
    "before" => null,
    "after" => null,
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
    
    error_log("[SHORTCODE FIX] Starting shortcode fix process");
    
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
    
    // Step 2: Check if shortcode has leading/trailing spaces
    $originalShortcode = $credentials['shortcode'] ?? '';
    $trimmedShortcode = trim($originalShortcode);
    
    $result["before"] = [
        "shortcode_raw" => $originalShortcode,
        "shortcode_length" => strlen($originalShortcode),
        "has_leading_space" => $originalShortcode !== ltrim($originalShortcode),
        "has_trailing_space" => $originalShortcode !== rtrim($originalShortcode)
    ];
    
    error_log("[SHORTCODE FIX] Before: '{$originalShortcode}' (length: " . strlen($originalShortcode) . ")");
    
    if ($originalShortcode === $trimmedShortcode) {
        $result["success"] = true;
        $result["message"] = "✅ Shortcode is already clean - no spaces found";
        $result["after"] = [
            "shortcode_raw" => $trimmedShortcode,
            "shortcode_length" => strlen($trimmedShortcode),
            "action_taken" => "none"
        ];
        error_log("[SHORTCODE FIX] No spaces detected - no action needed");
        http_response_code(200);
        echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    // Step 3: Update shortcode with trimmed version
    $credentials['shortcode'] = $trimmedShortcode;
    $updatedJson = json_encode($credentials);
    
    error_log("[SHORTCODE FIX] After: '{$trimmedShortcode}' (length: " . strlen($trimmedShortcode) . ")");
    
    // Step 4: Update database
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
    
    error_log("[SHORTCODE FIX] Database updated successfully");
    
    $result["success"] = true;
    $result["message"] = "✅ Shortcode fixed successfully! Removed leading/trailing spaces.";
    $result["after"] = [
        "shortcode_raw" => $trimmedShortcode,
        "shortcode_length" => strlen($trimmedShortcode),
        "action_taken" => "Trimmed spaces: '{$originalShortcode}' → '{$trimmedShortcode}'"
    ];
    $result["next_steps"] = [
        "1. Test payment via booking form",
        "2. Check error logs for '[MPESA STK INITIATE]' messages",
        "3. Verify M-Pesa prompt appears on phone",
        "4. Complete payment to confirm fix"
    ];
    
    http_response_code(200);
    
} catch (Exception $e) {
    $result["success"] = false;
    $result["message"] = "❌ Error: " . $e->getMessage();
    $result["errors"][] = $e->getMessage();
    error_log("[SHORTCODE FIX ERROR] " . $e->getMessage());
    http_response_code(500);
}

// Close database connection
if (isset($conn)) {
    $conn->close();
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
