<?php
// Load environment variables from .env file if it exists
if (file_exists(__DIR__ . '/.env')) {
    $env = parse_ini_file(__DIR__ . '/.env');
    foreach ($env as $key => $value) {
        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

// Database connection settings from environment variables
$server = getenv('DB_HOST') ?: 'localhost';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';
$database = getenv('DB_NAME') ?: 'trainer_db';
$port = (int)(getenv('DB_PORT') ?: 3306);

// Create connection
$conn = new mysqli($server, $username, $password, $database, $port);

// Check connection
if ($conn->connect_error) {
    error_log("Database connection error: " . $conn->connect_error);
    http_response_code(500);
    header("Content-Type: application/json; charset=utf-8");
    die(json_encode([
        "status" => "error",
        "message" => "Database connection failed. Please try again later."
    ]));
}

// Set charset to utf8mb4
$conn->set_charset("utf8mb4");

// Do NOT echo anything here
// api.php will handle the response
?>
