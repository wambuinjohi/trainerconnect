<?php
// ======================================
// ENHANCED MYSQL API FOR REACT FRONTEND
// TRAINER COACH CONNECT SYSTEM
// ======================================

// Include the database connection
include('connection.php');

// Allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Utility function for safe JSON response
function respond($status, $message, $data = null, $code = 200) {
    http_response_code($code);
    echo json_encode([
        "status" => $status,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

// Safe query builder helper
function buildWhereClause($conditions) {
    if (empty($conditions)) return "";
    $parts = [];
    foreach ($conditions as $column => $value) {
        $parts[] = "`" . addslashes($column) . "` = '" . addslashes($value) . "'";
    }
    return "WHERE " . implode(" AND ", $parts);
}

// Read input JSON
$input = json_decode(file_get_contents("php://input"), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    $input = $_GET ?? [];
}

// Verify input
if (!isset($input['action'])) {
    respond("error", "Missing action parameter.", null, 400);
}

$action = strtolower($input['action']);

// =============================
// GENERIC CRUD OPERATIONS
// =============================
switch ($action) {

    // CREATE TABLE (admin only)
    case 'create_table':
        if (!isset($input['table']) || !isset($input['columns'])) {
            respond("error", "Missing table or columns.", null, 400);
        }
        $table = $conn->real_escape_string($input['table']);
        $columns = $input['columns'];
        $columns_sql = implode(", ", $columns);
        $sql = "CREATE TABLE IF NOT EXISTS `$table` ($columns_sql)";
        if ($conn->query($sql)) {
            respond("success", "Table '$table' created successfully.");
        } else {
            respond("error", "Failed to create table: " . $conn->error, null, 500);
        }
        break;

    // INSERT (generic)
    case 'insert':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or data.", null, 400);
        }
        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        if (!is_array($data)) {
            respond("error", "Data must be an array.", null, 400);
        }
        
        // Handle upsert with onConflict
        $upsert = isset($input['upsert']) && $input['upsert'];
        $onConflict = isset($input['onConflict']) ? $input['onConflict'] : null;
        
        if ($upsert && $onConflict === 'user_id' && isset($data['user_id'])) {
            // Check if exists
            $existsResult = $conn->query("SELECT id FROM `$table` WHERE user_id = '" . $conn->real_escape_string($data['user_id']) . "' LIMIT 1");
            if ($existsResult->num_rows > 0) {
                // Update instead
                $updates = [];
                foreach ($data as $key => $value) {
                    if ($key === 'user_id') continue;
                    $updates[] = "`" . $conn->real_escape_string($key) . "` = '" . $conn->real_escape_string($value) . "'";
                }
                $sql = "UPDATE `$table` SET " . implode(", ", $updates) . " WHERE user_id = '" . $conn->real_escape_string($data['user_id']) . "'";
                if ($conn->query($sql)) {
                    respond("success", "Record upserted successfully.", ["affected_rows" => $conn->affected_rows]);
                } else {
                    respond("error", "Upsert failed: " . $conn->error, null, 500);
                }
            }
        }
        
        // Regular insert
        $columns = array_keys($data);
        $columns_str = "`" . implode("`, `", array_map([$conn, 'real_escape_string'], $columns)) . "`";
        $values_str = "'" . implode("', '", array_map([$conn, 'real_escape_string'], array_values($data))) . "'";
        $sql = "INSERT INTO `$table` ($columns_str) VALUES ($values_str)";
        
        if ($conn->query($sql)) {
            respond("success", "Record inserted successfully.", ["id" => $conn->insert_id]);
        } else {
            respond("error", "Insert failed: " . $conn->error, null, 500);
        }
        break;

    // SELECT (generic)
    case 'select':
        if (!isset($input['table'])) {
            respond("error", "Missing table name.", null, 400);
        }
        
        $table = $conn->real_escape_string($input['table']);
        $where = "";
        $orderBy = "";
        $limit = "";
        
        // WHERE clause
        if (isset($input['where'])) {
            $where = "WHERE " . $input['where'];
        } else if (isset($input['conditions'])) {
            $where = buildWhereClause($input['conditions']);
        }
        
        // ORDER BY
        if (isset($input['order'])) {
            $orderBy = "ORDER BY " . $input['order'];
        }
        
        // LIMIT
        if (isset($input['limit'])) {
            $limit = "LIMIT " . intval($input['limit']);
        }
        
        $sql = "SELECT * FROM `$table` $where $orderBy $limit";
        $result = $conn->query($sql);
        
        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }
        
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        
        // Get count if requested
        $count = null;
        if (isset($input['count']) && $input['count'] === 'exact') {
            $countSql = "SELECT COUNT(*) as cnt FROM `$table` $where";
            $countResult = $conn->query($countSql);
            if ($countResult) {
                $countRow = $countResult->fetch_assoc();
                $count = intval($countRow['cnt']);
            }
        }
        
        $response = ["data" => $rows];
        if ($count !== null) {
            $response["count"] = $count;
        }
        
        respond("success", "Data fetched successfully.", $response);
        break;

    // UPDATE (generic)
    case 'update':
        if (!isset($input['table']) || !isset($input['data']) || !isset($input['where'])) {
            respond("error", "Missing table, data, or where condition.", null, 400);
        }
        
        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        $updates = [];
        
        foreach ($data as $key => $value) {
            $updates[] = "`" . $conn->real_escape_string($key) . "` = '" . $conn->real_escape_string($value) . "'";
        }
        
        $sql = "UPDATE `$table` SET " . implode(", ", $updates) . " WHERE " . $input['where'];
        
        if ($conn->query($sql)) {
            respond("success", "Record updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Update failed: " . $conn->error, null, 500);
        }
        break;

    // DELETE (generic)
    case 'delete':
        if (!isset($input['table']) || !isset($input['where'])) {
            respond("error", "Missing table or where condition.", null, 400);
        }
        
        $table = $conn->real_escape_string($input['table']);
        $sql = "DELETE FROM `$table` WHERE " . $input['where'];
        
        if ($conn->query($sql)) {
            respond("success", "Record(s) deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Delete failed: " . $conn->error, null, 500);
        }
        break;

    // SEED TABLE
    case 'seed':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or seed data.", null, 400);
        }
        
        $table = $conn->real_escape_string($input['table']);
        $rows = $input['data'];
        $inserted = 0;
        
        foreach ($rows as $data) {
            $columns = implode("`, `", array_keys($data));
            $values = implode("', '", array_map([$conn, 'real_escape_string'], array_values($data)));
            $sql = "INSERT INTO `$table` (`$columns`) VALUES ('$values')";
            if ($conn->query($sql)) $inserted++;
        }
        
        respond("success", "$inserted record(s) seeded successfully.");
        break;

    // =============================
    // SPECIALIZED ENDPOINTS
    // =============================

    // AUTH: LOGIN
    case 'login':
        if (!isset($input['email']) || !isset($input['password'])) {
            respond("error", "Missing email or password.", null, 400);
        }
        
        $email = $conn->real_escape_string($input['email']);
        $password = $input['password']; // Don't escape yet
        
        // Check if user exists and password matches
        $sql = "SELECT id, email, password_hash FROM users WHERE email = '$email' LIMIT 1";
        $result = $conn->query($sql);

        if ($result->num_rows === 0) {
            respond("error", "Invalid email or password.", null, 401);
        }

        $user = $result->fetch_assoc();
        if (!password_verify($password, $user['password_hash'])) {
            respond("error", "Invalid email or password.", null, 401);
        }
        
        // Get user profile
        $profileSql = "SELECT * FROM user_profiles WHERE user_id = '" . $conn->real_escape_string($user['id']) . "' LIMIT 1";
        $profileResult = $conn->query($profileSql);
        $profile = $profileResult ? $profileResult->fetch_assoc() : null;
        
        // Return session token (JWT-like, simplified)
        $token = base64_encode(json_encode(["id" => $user['id'], "email" => $user['email'], "ts" => time()]));
        
        respond("success", "Login successful.", [
            "session" => [
                "user" => [
                    "id" => $user['id'],
                    "email" => $user['email']
                ],
                "access_token" => $token
            ],
            "profile" => $profile
        ]);
        break;

    // AUTH: SIGNUP
    case 'signup':
        if (!isset($input['email']) || !isset($input['password'])) {
            respond("error", "Missing email or password.", null, 400);
        }
        
        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];
        $userType = isset($input['user_type']) ? $conn->real_escape_string($input['user_type']) : 'client';
        
        // Check if user exists
        $checkSql = "SELECT id FROM users WHERE email = '$email' LIMIT 1";
        if ($conn->query($checkSql)->num_rows > 0) {
            respond("error", "User already exists.", null, 409);
        }
        
        // Create user
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        $userId = 'user_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $userId = $conn->real_escape_string($userId);
        $email = $conn->real_escape_string($email);
        $hashedPassword = $conn->real_escape_string($hashedPassword);

        $sql = "INSERT INTO users (id, email, password_hash, status, created_at) VALUES ('$userId', '$email', '$hashedPassword', 'active', '$now')";
        if (!$conn->query($sql)) {
            respond("error", "Failed to create user: " . $conn->error, null, 500);
        }

        // Create profile
        $profileId = 'profile_' . uniqid();
        $profileId = $conn->real_escape_string($profileId);
        $userType = $conn->real_escape_string($userType);
        $fullName = isset($input['full_name']) ? $conn->real_escape_string($input['full_name']) : '';
        $phoneNumber = isset($input['phone_number']) ? $conn->real_escape_string($input['phone_number']) : '';

        $profileSql = "INSERT INTO user_profiles (id, user_id, user_type, full_name, phone_number, created_at) VALUES ('$profileId', '$userId', '$userType', '$fullName', '$phoneNumber', '$now')";
        $profileResult = $conn->query($profileSql);
        if (!$profileResult) {
            // Log profile creation failure but don't fail the signup
            error_log("User profile creation failed for $userId: " . $conn->error);
        }
        
        $token = base64_encode(json_encode(["id" => $userId, "email" => $email, "ts" => time()]));
        
        respond("success", "Signup successful.", [
            "user" => ["id" => $userId, "email" => $email],
            "session" => ["access_token" => $token]
        ]);
        break;

    // GET CURRENT USER TYPE
    case 'get_user_type':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }
        
        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT user_type FROM user_profiles WHERE user_id = '$userId' LIMIT 1";
        $result = $conn->query($sql);
        
        if ($result->num_rows === 0) {
            respond("success", "User type fetched (default: client).", ["user_type" => "client"]);
        }
        
        $row = $result->fetch_assoc();
        respond("success", "User type fetched.", ["user_type" => $row['user_type'] ?? 'client']);
        break;

    // GET ALL USERS WITH PROFILES
    case 'get_users':
        $sql = "
            SELECT
                u.id, u.email, u.phone, u.first_name, u.last_name, u.status,
                u.created_at, u.updated_at,
                up.user_id, up.user_type, up.full_name, up.phone_number, up.bio,
                up.profile_image, up.hourly_rate, up.rating, up.total_reviews,
                up.is_approved
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            ORDER BY u.created_at DESC
        ";

        $result = $conn->query($sql);
        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        respond("success", "Users fetched successfully.", ["data" => $users]);
        break;

    // SEED ALL TEST USERS
    case 'seed_all_users':
        // Ensure user_profiles table exists
        $createProfilesTable = "
            CREATE TABLE IF NOT EXISTS `user_profiles` (
                `id` VARCHAR(36) PRIMARY KEY,
                `user_id` VARCHAR(36) NOT NULL UNIQUE,
                `user_type` VARCHAR(50) NOT NULL DEFAULT 'client',
                `full_name` VARCHAR(255),
                `phone_number` VARCHAR(20),
                `bio` TEXT,
                `profile_image` VARCHAR(255),
                `disciplines` JSON,
                `certifications` JSON,
                `hourly_rate` DECIMAL(10, 2),
                `service_radius` INT,
                `availability` JSON,
                `rating` DECIMAL(3, 2),
                `total_reviews` INT DEFAULT 0,
                `is_approved` BOOLEAN DEFAULT FALSE,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_user_type (user_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createProfilesTable);

        $testUsers = [
            [
                'email' => 'admin@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'user_type' => 'admin',
                'phone' => '+254712345601',
            ],
            [
                'email' => 'trainer@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Trainer',
                'last_name' => 'User',
                'user_type' => 'trainer',
                'phone' => '+254712345602',
            ],
            [
                'email' => 'client@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Client',
                'last_name' => 'User',
                'user_type' => 'client',
                'phone' => '+254712345603',
            ],
        ];

        $seeded = 0;
        $skipped = 0;
        $errors = [];
        $now = date('Y-m-d H:i:s');

        foreach ($testUsers as $user) {
            // Check if user already exists
            $checkEmail = $conn->real_escape_string($user['email']);
            $checkSql = "SELECT id FROM users WHERE email = '$checkEmail' LIMIT 1";
            $result = $conn->query($checkSql);

            if ($result && $result->num_rows > 0) {
                $skipped++;
                continue;
            }

            // Generate IDs
            $userId = 'user_' . uniqid();
            $profileId = 'profile_' . uniqid();

            // Hash password
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);

            // Escape all values
            $userId = $conn->real_escape_string($userId);
            $profileId = $conn->real_escape_string($profileId);
            $email = $conn->real_escape_string($user['email']);
            $phone = $conn->real_escape_string($user['phone']);
            $passwordHash = $conn->real_escape_string($passwordHash);
            $firstName = $conn->real_escape_string($user['first_name']);
            $lastName = $conn->real_escape_string($user['last_name']);
            $userType = $conn->real_escape_string($user['user_type']);
            $fullName = $conn->real_escape_string($user['first_name'] . ' ' . $user['last_name']);

            // Insert into users table
            $insertUserSql = "
                INSERT INTO users (
                    id, email, phone, password_hash,
                    first_name, last_name, status,
                    email_verified, phone_verified,
                    currency, kyc_status, created_at
                ) VALUES (
                    '$userId', '$email', '$phone', '$passwordHash',
                    '$firstName', '$lastName', 'active',
                    1, 0, 'KES', 'pending', '$now'
                )
            ";

            if ($conn->query($insertUserSql)) {
                // Insert into user_profiles table
                $insertProfileSql = "
                    INSERT INTO user_profiles (
                        id, user_id, user_type, full_name, phone_number, created_at
                    ) VALUES (
                        '$profileId', '$userId', '$userType', '$fullName', '$phone', '$now'
                    )
                ";

                if ($conn->query($insertProfileSql)) {
                    $seeded++;
                } else {
                    $errors[] = "Profile creation failed for {$user['email']}: " . $conn->error;
                    $seeded++;
                }
            } else {
                $errors[] = "User creation failed for {$user['email']}: " . $conn->error;
            }
        }

        $message = "Seeding complete: $seeded created, $skipped already exist.";
        if (!empty($errors)) {
            respond("success", $message . " (with " . count($errors) . " warning(s))", [
                "seeded" => $seeded,
                "skipped" => $skipped,
                "errors" => $errors
            ]);
        } else {
            respond("success", $message, [
                "seeded" => $seeded,
                "skipped" => $skipped
            ]);
        }
        break;

    // SEND AUDIT LOG
    case 'audit':
        $action = isset($input['action']) ? $conn->real_escape_string($input['action']) : 'unknown';
        $target = isset($input['target']) ? $conn->real_escape_string($input['target']) : null;
        $details = isset($input['details']) ? json_encode($input['details']) : null;
        $actor = isset($_SERVER['HTTP_X_ADMIN_ACTOR']) ? $conn->real_escape_string($_SERVER['HTTP_X_ADMIN_ACTOR']) : null;
        
        $now = date('Y-m-d H:i:s');
        $sql = "INSERT INTO audit_logs (action, target_id, details, actor, created_at) 
                VALUES ('$action', '$target', '$details', '$actor', '$now')";
        
        $conn->query($sql);
        respond("success", "Audit logged.");
        break;

    // UNKNOWN ACTION
    default:
        respond("error", "Invalid action '$action'.", null, 400);
}
?>
