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
    http_response_code(500);
    die(json_encode([
        "status" => "error",
        "message" => "Connection failed: " . $conn->connect_error
    ]));
}

// Do NOT echo anything here
// api.php will handle the response
?>
