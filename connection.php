<?php
// Database connection settings
$server = "localhost";
$username = "skatrykc_trainer";
$password = "Sirgeorge.12";
$database = "skatrykc_trainer";

// Create connection
$conn = new mysqli($server, $username, $password, $database);

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

// Do NOT echo anything here
// api.php will handle the response
?>
