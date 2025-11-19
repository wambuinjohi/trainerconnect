<?php
// ======================================
// UNIVERSAL MYSQL API FOR REACT FRONTEND
// ======================================

// Set headers before any output
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set error handler to prevent HTML error output
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    if (!headers_sent()) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "An error occurred. Please try again later."
        ]);
    }
    exit;
});

// Include the database connection
include('connection.php');

// Utility function for logging API events
function logEvent($eventType, $details = []) {
    $timestamp = date('Y-m-d H:i:s');
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

    $logEntry = [
        'timestamp' => $timestamp,
        'event_type' => $eventType,
        'client_ip' => $clientIp,
        'user_agent' => substr($userAgent, 0, 200),
    ];

    // Merge with additional details
    $logEntry = array_merge($logEntry, $details);

    // Log to PHP error log (available in server logs)
    error_log(json_encode($logEntry));

    // Also log to a custom API log file
    $logFile = __DIR__ . '/api_events.log';
    $logLine = json_encode($logEntry) . PHP_EOL;
    @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
}

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Utility function for safe JSON response
function respond($status, $message, $data = null) {
    echo json_encode(["status" => $status, "message" => $message, "data" => $data]);
    exit;
}

// =============================
// HANDLE FILE UPLOADS (MULTIPART)
// =============================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_FILES)) {
    // Configuration
    $uploadDir = __DIR__ . '/public/uploads/';
    $maxFileSize = 50 * 1024 * 1024; // 50MB
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi', 'mov', 'webm', 'zip', 'rar'];
    $allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/webm',
        'application/zip', 'application/x-rar-compressed'
    ];

    // Create uploads directory if it doesn't exist
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            respond("error", "Failed to create uploads directory.");
        }
    }

    $uploadedFiles = [];
    $errors = [];

    // Process each uploaded file
    foreach ($_FILES as $fieldName => $fileData) {
        // Handle both single and multiple files
        $files = is_array($fileData['name']) ? $fileData : [$fileData];

        if (!is_array($files['name'])) {
            $files = [
                'name' => [$files['name']],
                'type' => [$files['type']],
                'tmp_name' => [$files['tmp_name']],
                'error' => [$files['error']],
                'size' => [$files['size']]
            ];
        }

        for ($i = 0; $i < count($files['name']); $i++) {
            $fileName = trim($files['name'][$i]);
            $fileTmpName = $files['tmp_name'][$i];
            $fileError = $files['error'][$i];
            $fileSize = $files['size'][$i];
            $fileMimeType = $files['type'][$i];

            // Skip empty files
            if (empty($fileName)) {
                continue;
            }

            // Check for upload errors
            if ($fileError !== UPLOAD_ERR_OK) {
                $errorMessages = [
                    UPLOAD_ERR_INI_SIZE => "File exceeds upload_max_filesize directive",
                    UPLOAD_ERR_FORM_SIZE => "File exceeds MAX_FILE_SIZE directive",
                    UPLOAD_ERR_PARTIAL => "File was only partially uploaded",
                    UPLOAD_ERR_NO_FILE => "No file was uploaded",
                    UPLOAD_ERR_NO_TMP_DIR => "Missing temporary folder",
                    UPLOAD_ERR_CANT_WRITE => "Failed to write file to disk",
                    UPLOAD_ERR_EXTENSION => "PHP extension blocked the file upload"
                ];
                $errors[] = "$fileName: " . ($errorMessages[$fileError] ?? "Unknown error");
                continue;
            }

            // Validate file size
            if ($fileSize > $maxFileSize) {
                $errors[] = "$fileName: File size exceeds 50MB limit";
                continue;
            }

            // Validate file extension
            $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (!in_array($fileExt, $allowedExtensions)) {
                $errors[] = "$fileName: File type not allowed (.$fileExt)";
                continue;
            }

            // Validate MIME type
            if (!in_array($fileMimeType, $allowedMimeTypes)) {
                $errors[] = "$fileName: Invalid MIME type detected";
                continue;
            }

            // Generate unique filename
            $uniqueFileName = uniqid('file_') . '_' . time() . '.' . $fileExt;
            $uploadPath = $uploadDir . $uniqueFileName;

            // Move uploaded file
            if (!move_uploaded_file($fileTmpName, $uploadPath)) {
                $errors[] = "$fileName: Failed to save file";
                continue;
            }

            // Set proper permissions
            chmod($uploadPath, 0644);

            // Build file URL - adjusted to reflect public/uploads location
            $fileUrl = '/public/uploads/' . $uniqueFileName;

            $uploadedFiles[] = [
                'originalName' => $fileName,
                'fileName' => $uniqueFileName,
                'url' => $fileUrl,
                'size' => $fileSize,
                'mimeType' => $fileMimeType,
                'uploadedAt' => date('Y-m-d H:i:s')
            ];
        }
    }

    // Prepare response
    if (empty($uploadedFiles) && !empty($errors)) {
        respond("error", "File upload failed. " . implode("; ", $errors));
    } else {
        $message = "Upload completed";
        if (!empty($errors)) {
            $message .= " with " . count($errors) . " error(s)";
        }
        respond("success", $message, [
            "uploaded" => $uploadedFiles,
            "errors" => $errors,
            "count" => count($uploadedFiles)
        ]);
    }
}

// Read input JSON
$input = json_decode(file_get_contents("php://input"), true);

// Verify input
if (!isset($input['action'])) {
    respond("error", "Missing action parameter.");
}

$action = strtolower($input['action']);

// =============================
// ACTION HANDLERS
// =============================
switch ($action) {

    // CREATE TABLE DYNAMICALLY
    case 'create_table':
        if (!isset($input['table']) || !isset($input['columns'])) {
            respond("error", "Missing table or columns.");
        }

        $table = $conn->real_escape_string($input['table']);
        $columns = $input['columns'];

        // Example: ["id INT AUTO_INCREMENT PRIMARY KEY", "name VARCHAR(255)", "email VARCHAR(255)"]
        $columns_sql = implode(", ", $columns);
        $sql = "CREATE TABLE IF NOT EXISTS `$table` ($columns_sql)";

        if ($conn->query($sql)) {
            respond("success", "Table '$table' created successfully.");
        } else {
            respond("error", "Failed to create table: " . $conn->error);
        }
        break;

    // INSERT DATA
    case 'insert':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or data.");
        }

        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];

        $columns = implode("`, `", array_keys($data));
        $values = implode("', '", array_map([$conn, 'real_escape_string'], array_values($data)));

        $sql = "INSERT INTO `$table` (`$columns`) VALUES ('$values')";
        if ($conn->query($sql)) {
            respond("success", "Record inserted successfully.", ["id" => $conn->insert_id]);
        } else {
            respond("error", "Insert failed: " . $conn->error);
        }
        break;

    // READ / SELECT DATA
    case 'select':
        if (!isset($input['table'])) {
            respond("error", "Missing table name.");
        }

        $table = $conn->real_escape_string($input['table']);
        $where = isset($input['where']) ? "WHERE " . $input['where'] : "";
        $sql = "SELECT * FROM `$table` $where";
        $result = $conn->query($sql);

        if (!$result) respond("error", "Query failed: " . $conn->error);

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;

        respond("success", "Data fetched successfully.", $rows);
        break;

    // UPDATE DATA
    case 'update':
        if (!isset($input['table']) || !isset($input['data']) || !isset($input['where'])) {
            respond("error", "Missing table, data, or where condition.");
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
            respond("error", "Update failed: " . $conn->error);
        }
        break;

    // DELETE DATA
    case 'delete':
        if (!isset($input['table']) || !isset($input['where'])) {
            respond("error", "Missing table or where condition.");
        }

        $table = $conn->real_escape_string($input['table']);
        $sql = "DELETE FROM `$table` WHERE " . $input['where'];

        if ($conn->query($sql)) {
            respond("success", "Record(s) deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Delete failed: " . $conn->error);
        }
        break;

    // SEED TABLE WITH SAMPLE DATA
    case 'seed':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or seed data.");
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

    // HEALTH CHECK ACTION
    case 'health_check':
        logEvent('health_check', ['status' => 'success']);
        respond("success", "API is healthy and responding correctly.");
        break;

    // LOGIN ACTION
    case 'login':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('login_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.");
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];

        logEvent('login_attempt', ['email' => $email]);

        // Query user by email using prepared statement
        $stmt = $conn->prepare("SELECT id, email, first_name, last_name, password_hash, status FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if (!$result || $result->num_rows === 0) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'user_not_found']);
            respond("error", "Invalid email or password.");
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        // Verify password using password_verify
        if (!password_verify($password, $user['password_hash'])) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'invalid_password']);
            respond("error", "Invalid email or password.");
        }

        // Check user status
        if ($user['status'] !== 'active') {
            logEvent('login_failed', ['email' => $email, 'reason' => 'inactive_account', 'status' => $user['status']]);
            respond("error", "User account is not active.");
        }

        // Generate access token (simple base64 encoded JSON)
        $token = base64_encode(json_encode([
            "id" => $user['id'],
            "email" => $user['email'],
            "ts" => time(),
            "exp" => time() + (7 * 24 * 60 * 60) // 7 days
        ]));

        // Update last_login using prepared statement
        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("UPDATE users SET last_login = ? WHERE id = ?");
        $stmt->bind_param("ss", $now, $user['id']);
        $stmt->execute();
        $stmt->close();

        // Fetch user profile
        $stmt = $conn->prepare("SELECT user_type FROM user_profiles WHERE user_id = ? LIMIT 1");
        $stmt->bind_param("s", $user['id']);
        $stmt->execute();
        $profileResult = $stmt->get_result();
        $profile = $profileResult->fetch_assoc();
        $stmt->close();

        // Log successful login
        logEvent('login_success', [
            'email' => $user['email'],
            'user_id' => $user['id'],
            'user_type' => $profile['user_type'] ?? 'client'
        ]);

        // Return user and token
        respond("success", "Login successful.", [
            "user" => [
                "id" => $user['id'],
                "email" => $user['email'],
                "first_name" => $user['first_name'],
                "last_name" => $user['last_name']
            ],
            "profile" => $profile,
            "session" => [
                "access_token" => $token
            ]
        ]);
        break;

    // SIGNUP ACTION
    case 'signup':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('signup_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.");
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];
        $firstName = isset($input['first_name']) ? $conn->real_escape_string($input['first_name']) : '';
        $lastName = isset($input['last_name']) ? $conn->real_escape_string($input['last_name']) : '';
        $phone = isset($input['phone']) ? $conn->real_escape_string($input['phone']) : NULL;
        $country = isset($input['country']) ? $conn->real_escape_string($input['country']) : NULL;
        $userType = isset($input['user_type']) ? $conn->real_escape_string($input['user_type']) : 'client';

        logEvent('signup_attempt', ['email' => $email, 'user_type' => $userType]);

        // Check if user exists using prepared statement
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $checkResult = $stmt->get_result();
        if ($checkResult->num_rows > 0) {
            $stmt->close();
            logEvent('signup_failed', ['email' => $email, 'reason' => 'user_already_exists']);
            respond("error", "User already exists.");
        }
        $stmt->close();

        // Hash password using PASSWORD_BCRYPT
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        // Create user using prepared statement
        $userId = 'user_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO users (
                id, email, password_hash, first_name, last_name,
                phone, country, status, email_verified, phone_verified,
                currency, kyc_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, 'KES', 'pending', ?, ?)
        ");
        $stmt->bind_param("sssssssss", $userId, $email, $passwordHash, $firstName, $lastName, $phone, $country, $now, $now);

        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            respond("error", "Failed to create user: " . $error);
        }
        $stmt->close();

        // Create user profile entry
        $profileId = 'profile_' . uniqid();
        $fullName = trim($firstName . ' ' . $lastName);

        $stmt = $conn->prepare("
            INSERT INTO user_profiles (id, user_id, user_type, full_name, phone_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $profileId, $userId, $userType, $fullName, $phone, $now);
        $stmt->execute();
        $stmt->close();

        // Generate access token
        $token = base64_encode(json_encode([
            "id" => $userId,
            "email" => $email,
            "ts" => time(),
            "exp" => time() + (7 * 24 * 60 * 60)
        ]));

        logEvent('signup_success', [
            'email' => $email,
            'user_id' => $userId,
            'user_type' => $userType
        ]);

        respond("success", "Signup successful.", [
            "user" => [
                "id" => $userId,
                "email" => $email,
                "first_name" => $firstName,
                "last_name" => $lastName
            ],
            "profile" => [
                "user_type" => $userType
            ],
            "session" => [
                "access_token" => $token
            ]
        ]);
        break;

    // MIGRATE: Create users and password_reset_tokens tables
    case 'migrate':
        $sql = "
        CREATE TABLE IF NOT EXISTS `users` (
          `id` VARCHAR(36) PRIMARY KEY,
          `email` VARCHAR(255) NOT NULL UNIQUE,
          `phone` VARCHAR(20),
          `password_hash` VARCHAR(255) NOT NULL,
          `first_name` VARCHAR(100),
          `last_name` VARCHAR(100),
          `date_of_birth` DATE,
          `status` VARCHAR(50) DEFAULT 'active',
          `balance` DECIMAL(15, 2) DEFAULT 0,
          `bonus_balance` DECIMAL(15, 2) DEFAULT 0,
          `currency` VARCHAR(3) DEFAULT 'KES',
          `country` VARCHAR(100),
          `email_verified` BOOLEAN DEFAULT FALSE,
          `phone_verified` BOOLEAN DEFAULT FALSE,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          `last_login` TIMESTAMP NULL,
          `kyc_status` VARCHAR(50) DEFAULT 'pending',
          INDEX idx_email (email),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";

        if ($conn->query($sql)) {
            respond("success", "Migration successful: users table created or already exists.");
        } else {
            respond("error", "Migration failed: " . $conn->error);
        }

        // Create password_reset_tokens table
        $resetTokensTable = "
        CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
          `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          `user_id` VARCHAR(36) NOT NULL,
          `token` VARCHAR(255) NOT NULL UNIQUE,
          `expires_at` TIMESTAMP NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_token (token),
          INDEX idx_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";

        if ($conn->query($resetTokensTable)) {
            respond("success", "Migration successful: users and password_reset_tokens tables created or already exist.");
        } else {
            respond("error", "Migration failed: " . $conn->error);
        }
        break;

    // SEED_USERS: Create test users
    case 'seed_users':
        $testUsers = [
            [
                'email' => 'admin@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'phone' => '+254712345601',
                'country' => 'Kenya',
            ],
            [
                'email' => 'trainer@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Trainer',
                'last_name' => 'User',
                'phone' => '+254712345602',
                'country' => 'Kenya',
            ],
            [
                'email' => 'client@skatryk.co.ke',
                'password' => 'Test1234',
                'first_name' => 'Client',
                'last_name' => 'User',
                'phone' => '+254712345603',
                'country' => 'Kenya',
            ],
        ];

        $seeded = 0;
        $skipped = 0;
        $errors = [];

        foreach ($testUsers as $user) {
            // Check if user exists
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->bind_param("s", $user['email']);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result && $result->num_rows > 0) {
                $stmt->close();
                $skipped++;
                continue;
            }
            $stmt->close();

            $id = 'user_' . uniqid();
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);

            $stmt = $conn->prepare("
                INSERT INTO users (
                    id, email, phone, password_hash,
                    first_name, last_name, country,
                    status, email_verified, phone_verified,
                    currency, kyc_status, created_at
                ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    'active', 1, 0,
                    'KES', 'pending', NOW()
                )
            ");
            $stmt->bind_param("sssssss", $id, $user['email'], $user['phone'], $passwordHash, $user['first_name'], $user['last_name'], $user['country']);

            if ($stmt->execute()) {
                $seeded++;
            } else {
                $errors[] = "{$user['email']}: " . $stmt->error;
            }
            $stmt->close();
        }

        $message = "Seeding complete: $seeded created, $skipped already exist.";
        if (!empty($errors)) {
            respond("error", $message . " Errors: " . implode("; ", $errors), ["seeded" => $seeded, "skipped" => $skipped]);
        } else {
            respond("success", $message, ["seeded" => $seeded, "skipped" => $skipped]);
        }
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
            respond("error", "Query failed: " . $conn->error);
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        respond("success", "Users fetched successfully.", $users);
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
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->bind_param("s", $user['email']);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result && $result->num_rows > 0) {
                $stmt->close();
                $skipped++;
                continue;
            }
            $stmt->close();

            // Generate IDs
            $userId = 'user_' . uniqid();
            $profileId = 'profile_' . uniqid();

            // Hash password
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);
            $fullName = trim($user['first_name'] . ' ' . $user['last_name']);

            // Insert into users table
            $stmt = $conn->prepare("
                INSERT INTO users (
                    id, email, phone, password_hash,
                    first_name, last_name, status,
                    email_verified, phone_verified,
                    currency, kyc_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 0, 'KES', 'pending', ?)
            ");
            $stmt->bind_param("sssssss", $userId, $user['email'], $user['phone'], $passwordHash, $user['first_name'], $user['last_name'], $now);

            if ($stmt->execute()) {
                $stmt->close();
                
                // Insert into user_profiles table
                $stmt = $conn->prepare("
                    INSERT INTO user_profiles (
                        id, user_id, user_type, full_name, phone_number, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->bind_param("ssssss", $profileId, $userId, $user['user_type'], $fullName, $user['phone'], $now);

                if ($stmt->execute()) {
                    $seeded++;
                } else {
                    $errors[] = "Profile creation failed for {$user['email']}: " . $stmt->error;
                    $seeded++;
                }
                $stmt->close();
            } else {
                $errors[] = "User creation failed for {$user['email']}: " . $stmt->error;
                $stmt->close();
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

    // REQUEST PASSWORD RESET: Send reset email
    case 'request_password_reset':
        if (!isset($input['email'])) {
            respond("error", "Email is required.");
        }

        $email = $conn->real_escape_string($input['email']);

        $stmt = $conn->prepare("SELECT id, email, first_name FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if (!$result || $result->num_rows === 0) {
            error_log("Password reset requested for non-existent email: " . $email);
            respond("success", "If an account exists with this email, you will receive a password reset link.");
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        // Generate reset token
        $resetToken = bin2hex(random_bytes(32));
        $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));

        // Store reset token in a password_reset_tokens table
        $stmt = $conn->prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->bind_param("sss", $user['id'], $resetToken, $tokenExpiry);

        if ($stmt->execute()) {
            error_log("Password reset token generated for: " . $email);
            $stmt->close();

            // In production, send email here
            // For now, just return success
            respond("success", "Password reset link has been sent to your email.", [
                "email" => $email,
                "token" => $resetToken // In production, don't return token in response
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to generate reset link. Please try again.");
        }
        break;

    // RESET PASSWORD WITH TOKEN: Complete password reset
    case 'reset_password_with_token':
        if (!isset($input['email']) || !isset($input['token']) || !isset($input['new_password'])) {
            respond("error", "Email, token, and new password are required.");
        }

        $email = $conn->real_escape_string($input['email']);
        $token = $conn->real_escape_string($input['token']);
        $newPassword = $input['new_password'];

        if (strlen($newPassword) < 8) {
            respond("error", "Password must be at least 8 characters long.");
        }

        // Find user
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $userResult = $stmt->get_result();

        if (!$userResult || $userResult->num_rows === 0) {
            respond("error", "User not found.");
        }

        $user = $userResult->fetch_assoc();
        $stmt->close();

        // Verify token
        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("SELECT id FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > ? LIMIT 1");
        $stmt->bind_param("sss", $user['id'], $token, $now);
        $stmt->execute();
        $tokenResult = $stmt->get_result();

        if (!$tokenResult || $tokenResult->num_rows === 0) {
            error_log("Invalid or expired password reset token for: " . $email);
            respond("error", "Reset link is invalid or has expired.");
        }

        $stmt->close();

        // Hash new password
        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update password
        $stmt = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("ss", $passwordHash, $user['id']);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to update password. Please try again.");
        }

        $stmt->close();

        // Delete used token
        $stmt = $conn->prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND token = ?");
        $stmt->bind_param("ss", $user['id'], $token);
        $stmt->execute();
        $stmt->close();

        error_log("Password reset successful for: " . $email);
        respond("success", "Password has been reset successfully.");
        break;

    // RESET PASSWORDS: Reset all test user passwords
    case 'reset_passwords':
        $newPassword = isset($input['password']) ? $input['password'] : 'Test123';

        if (strlen($newPassword) < 6) {
            respond("error", "Password must be at least 6 characters long.");
        }

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        $testEmails = ['admin@skatryk.co.ke', 'trainer@skatryk.co.ke', 'client@skatryk.co.ke'];
        $updated = 0;
        $errors = [];

        foreach ($testEmails as $email) {
            $stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
            $stmt->bind_param("ss", $passwordHash, $email);

            if ($stmt->execute()) {
                $updated++;
                error_log("Password reset for: " . $email);
            } else {
                $errors[] = "{$email}: " . $stmt->error;
            }
            $stmt->close();
        }

        if (!empty($errors)) {
            respond("success", "Password reset complete: $updated users updated. Errors: " . implode("; ", $errors), ["updated" => $updated, "errors" => $errors]);
        } else {
            respond("success", "Password reset complete: $updated users updated to '$newPassword'.", ["updated" => $updated]);
        }
        break;

    // UNKNOWN ACTION
    default:
        respond("error", "Invalid action '$action'.");
}
?>
