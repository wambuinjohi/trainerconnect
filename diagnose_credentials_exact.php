<?php
/**
 * Diagnose Exact Credential Format
 * 
 * Shows the EXACT raw credentials including:
 * - Exact length of each field
 * - Character breakdown
 * - Leading/trailing spaces
 * - Base64 encoding used for M-Pesa auth
 * - Exact auth string that will be sent
 * 
 * Access via: https://your-domain.com/diagnose_credentials_exact.php
 */

header("Content-Type: application/json; charset=utf-8");

$diagnosis = [
    "timestamp" => date('Y-m-d H:i:s'),
    "analysis" => "Exact credential format and encoding diagnosis",
    "credentials_analysis" => [],
    "auth_string_analysis" => [],
    "errors" => []
];

try {
    // Load database connection
    include_once(__DIR__ . '/connection.php');
    
    if (!isset($conn) || !$conn) {
        throw new Exception("Database connection failed");
    }
    
    error_log("[CREDS DIAG] Starting detailed credential analysis");
    
    // Get current credentials
    $sql = "SELECT value FROM platform_settings WHERE setting_key = 'mpesa_credentials' LIMIT 1";
    $queryResult = $conn->query($sql);
    
    if (!$queryResult || $queryResult->num_rows === 0) {
        throw new Exception("M-Pesa credentials not found");
    }
    
    $row = $queryResult->fetch_assoc();
    $credentials = json_decode($row['value'], true);
    
    if (!$credentials) {
        throw new Exception("Could not parse credentials JSON");
    }
    
    // Analyze each credential field
    $fieldsToAnalyze = [
        'environment',
        'consumerKey',
        'consumerSecret',
        'shortcode',
        'passkey',
        'initiatorName',
        'c2bCallbackUrl',
        'b2cCallbackUrl',
        'resultUrl'
    ];
    
    foreach ($fieldsToAnalyze as $field) {
        if (isset($credentials[$field])) {
            $value = $credentials[$field];
            
            // Analyze the value
            $analysis = [
                "field" => $field,
                "raw_value_preview" => $value,
                "exact_length" => strlen($value),
                "starts_with_space" => $value !== ltrim($value),
                "ends_with_space" => $value !== rtrim($value),
                "contains_newline" => strpos($value, "\n") !== false,
                "contains_tab" => strpos($value, "\t") !== false,
                "contains_quotes" => (strpos($value, '"') !== false || strpos($value, "'") !== false),
                "first_char_code" => ord($value[0]),
                "last_char_code" => ord($value[strlen($value)-1]),
                "trimmed_length" => strlen(trim($value)),
                "needs_cleaning" => $value !== trim($value)
            ];
            
            // For sensitive fields, show only first and last chars
            if (in_array($field, ['consumerKey', 'consumerSecret', 'passkey'])) {
                $analysis["raw_value_preview"] = 
                    substr($value, 0, 5) . "..." . substr($value, -5) . 
                    " (length: " . strlen($value) . ")";
            }
            
            $diagnosis["credentials_analysis"][] = $analysis;
        }
    }
    
    // Analyze the auth string that will be sent to M-Pesa
    if (isset($credentials['consumerKey']) && isset($credentials['consumerSecret'])) {
        $consumerKey = $credentials['consumerKey'];
        $consumerSecret = $credentials['consumerSecret'];
        
        // This is what will be base64 encoded for M-Pesa
        $authString = $consumerKey . ':' . $consumerSecret;
        $authStringBase64 = base64_encode($authString);
        
        $diagnosis["auth_string_analysis"] = [
            "consumer_key_length" => strlen($consumerKey),
            "consumer_secret_length" => strlen($consumerSecret),
            "auth_string_before_base64" => 
                substr($consumerKey, 0, 3) . "...:" . substr($consumerSecret, 0, 3) . "...",
            "auth_string_exact_length" => strlen($authString),
            "auth_string_base64" => $authStringBase64,
            "auth_string_base64_length" => strlen($authStringBase64),
            "http_authorization_header" => "Authorization: Basic " . $authStringBase64,
            "issues_detected" => []
        ];
        
        // Check for common issues
        if ($consumerKey !== trim($consumerKey)) {
            $diagnosis["auth_string_analysis"]["issues_detected"][] = 
                "Consumer Key has leading or trailing spaces";
        }
        if ($consumerSecret !== trim($consumerSecret)) {
            $diagnosis["auth_string_analysis"]["issues_detected"][] = 
                "Consumer Secret has leading or trailing spaces";
        }
        if (strpos($consumerKey, ' ') !== false) {
            $diagnosis["auth_string_analysis"]["issues_detected"][] = 
                "Consumer Key contains spaces within the string";
        }
        if (strpos($consumerSecret, ' ') !== false) {
            $diagnosis["auth_string_analysis"]["issues_detected"][] = 
                "Consumer Secret contains spaces within the string";
        }
        
        if (empty($diagnosis["auth_string_analysis"]["issues_detected"])) {
            $diagnosis["auth_string_analysis"]["status"] = "✅ Auth string looks valid";
        } else {
            $diagnosis["auth_string_analysis"]["status"] = "⚠️ Issues found";
        }
    }
    
    // Recommendations
    $diagnosis["recommendations"] = [
        "1. Review the 'needs_cleaning' fields above",
        "2. If any field shows 'needs_cleaning': true, run: https://your-domain.com/clean_all_credentials.php",
        "3. If 'issues_detected' shows problems, contact admin to re-enter credentials",
        "4. After cleaning, test with: https://your-domain.com/test_mpesa_api.php"
    ];
    
    http_response_code(200);
    
} catch (Exception $e) {
    $diagnosis["error"] = $e->getMessage();
    error_log("[CREDS DIAG ERROR] " . $e->getMessage());
    http_response_code(500);
}

if (isset($conn)) {
    $conn->close();
}

echo json_encode($diagnosis, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
?>
