<?php
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// Mock responses for development
switch ($action) {
    case 'get_users':
        // Return empty array to indicate no users (setup needed, but we'll allow app to load)
        echo json_encode([
            "status" => "success",
            "data" => []
        ]);
        exit;
    
    case 'migrate':
        // Migration success mock
        echo json_encode([
            "status" => "success",
            "message" => "Migration completed"
        ]);
        exit;
    
    case 'seed_all_users':
        // Seeding success mock
        echo json_encode([
            "status" => "success",
            "message" => "Users seeded successfully",
            "data" => []
        ]);
        exit;
    
    case 'login':
        // Allow any login in development
        $email = $input['email'] ?? '';
        echo json_encode([
            "status" => "success",
            "message" => "Login successful",
            "data" => [
                "user" => [
                    "id" => "dev-user-" . substr(md5($email), 0, 8),
                    "email" => $email
                ],
                "profile" => [
                    "user_type" => "client"
                ],
                "session" => [
                    "access_token" => "dev-token-" . bin2hex(random_bytes(16))
                ]
            ]
        ]);
        exit;
    
    case 'signup':
        // Allow any signup in development
        $email = $input['email'] ?? '';
        $user_type = $input['user_type'] ?? 'client';
        echo json_encode([
            "status" => "success",
            "message" => "Signup successful",
            "data" => [
                "user" => [
                    "id" => "dev-user-" . substr(md5($email), 0, 8),
                    "email" => $email
                ],
                "profile" => [
                    "user_type" => $user_type
                ],
                "session" => [
                    "access_token" => "dev-token-" . bin2hex(random_bytes(16))
                ]
            ]
        ]);
        exit;
    
    case 'get_categories':
        // Return mock categories
        echo json_encode([
            "status" => "success",
            "data" => [
                [
                    "id" => 1,
                    "name" => "Strength Training",
                    "description" => "Build muscle and increase strength"
                ],
                [
                    "id" => 2,
                    "name" => "Cardio",
                    "description" => "Improve cardiovascular fitness"
                ],
                [
                    "id" => 3,
                    "name" => "Flexibility",
                    "description" => "Enhance flexibility and mobility"
                ]
            ]
        ]);
        exit;
    
    default:
        // For any other action, return a success response with empty data
        echo json_encode([
            "status" => "success",
            "message" => "Action processed",
            "data" => []
        ]);
        exit;
}
?>
