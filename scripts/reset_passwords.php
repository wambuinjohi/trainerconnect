<?php
/**
 * Reset test user passwords script
 * Usage: php scripts/reset_passwords.php <api_url>
 * Example: php scripts/reset_passwords.php https://trainer.skatryk.co.ke/api.php
 */

$apiUrl = isset($argv[1]) ? $argv[1] : 'https://trainer.skatryk.co.ke/api.php';
$newPassword = 'Pass1234';

echo "🔄 Resetting user passwords via API: $apiUrl\n";
echo "📝 Resetting passwords for test users to: $newPassword\n\n";

$payload = json_encode(['action' => 'reset_passwords']);

$options = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n" .
                    "Content-Length: " . strlen($payload) . "\r\n",
        'content' => $payload,
        'timeout' => 30,
    ],
];

$context = stream_context_create($options);

try {
    $response = @file_get_contents($apiUrl, false, $context);
    
    if ($response === false) {
        echo "❌ Error: Failed to connect to API\n";
        exit(1);
    }

    $result = json_decode($response, true);

    if (!is_array($result)) {
        echo "❌ Error: Invalid JSON response from API\n";
        echo "Response: " . substr($response, 0, 500) . "\n";
        exit(1);
    }

    if (isset($result['status']) && $result['status'] === 'error') {
        echo "❌ Error: " . ($result['message'] ?? 'Unknown error') . "\n";
        exit(1);
    }

    echo "✅ Success: " . ($result['message'] ?? 'Password reset completed') . "\n";
    
    if (isset($result['data']['updated'])) {
        echo "📊 Updated: " . $result['data']['updated'] . " users\n";
    }

    if (isset($result['data']['errors']) && !empty($result['data']['errors'])) {
        echo "⚠️  Errors:\n";
        foreach ($result['data']['errors'] as $error) {
            echo "   - $error\n";
        }
    }

    echo "\n✨ Password reset complete!\n";
    echo "Test user credentials:\n";
    echo "  - admin@skatryk.co.ke / $newPassword\n";
    echo "  - trainer@skatryk.co.ke / $newPassword\n";
    echo "  - client@skatryk.co.ke / $newPassword\n";

    exit(0);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
