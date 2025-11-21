<?php
// ======================================
// UNIVERSAL MYSQL API FOR REACT FRONTEND
// TRAINER COACH CONNECT SYSTEM
// ======================================

// Disable output buffering and output directly
if (ob_get_level()) {
    ob_end_clean();
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set headers BEFORE any output
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Admin-Actor");
}

// Set error handler to prevent HTML error output
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");
    if (!headers_sent()) {
        http_response_code(500);
        header("Content-Type: application/json; charset=utf-8");
    }
    echo json_encode([
        "status" => "error",
        "message" => "Server error. Please check the logs."
    ]);
    exit;
}, E_ALL);

// Register shutdown function to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header("Content-Type: application/json; charset=utf-8");
        }
        echo json_encode([
            "status" => "error",
            "message" => "Server error: " . $error['message']
        ]);
    }
});

// Include the database connection
include('connection.php');

// Include M-Pesa helper functions
include('mpesa_helper.php');

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

    $logEntry = array_merge($logEntry, $details);

    error_log(json_encode($logEntry));

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
function respond($status, $message, $data = null, $code = 200) {
    if (!headers_sent()) {
        http_response_code($code);
        header("Content-Type: application/json; charset=utf-8");
    }
    $response = ["status" => $status, "message" => $message, "data" => $data];
    $json = json_encode($response);
    if ($json === false) {
        echo json_encode(["status" => "error", "message" => "Response encoding failed"]);
    } else {
        echo $json;
    }
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

// =============================
// HANDLE FILE UPLOADS (MULTIPART)
// =============================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_FILES)) {
    $uploadDir = __DIR__ . '/uploads/';
    $maxFileSize = 50 * 1024 * 1024;
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

    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            respond("error", "Failed to create uploads directory.", null, 500);
        }
    }

    $uploadedFiles = [];
    $errors = [];

    foreach ($_FILES as $fieldName => $fileData) {
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

            if (empty($fileName)) {
                continue;
            }

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

            if ($fileSize > $maxFileSize) {
                $errors[] = "$fileName: File size exceeds 50MB limit";
                continue;
            }

            $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            if (!in_array($fileExt, $allowedExtensions)) {
                $errors[] = "$fileName: File type not allowed (.$fileExt)";
                continue;
            }

            if (!in_array($fileMimeType, $allowedMimeTypes)) {
                $errors[] = "$fileName: Invalid MIME type detected";
                continue;
            }

            $uniqueFileName = uniqid('file_') . '_' . time() . '.' . $fileExt;
            $uploadPath = $uploadDir . $uniqueFileName;

            if (!move_uploaded_file($fileTmpName, $uploadPath)) {
                $errors[] = "$fileName: Failed to save file";
                continue;
            }

            chmod($uploadPath, 0644);

            $fileUrl = '/uploads/' . $uniqueFileName;

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

    if (empty($uploadedFiles) && !empty($errors)) {
        respond("error", "File upload failed. " . implode("; ", $errors), null, 400);
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
$rawInput = file_get_contents("php://input");
$input = null;

if (!empty($rawInput)) {
    $input = json_decode($rawInput, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        respond("error", "Invalid JSON in request body.", null, 400);
    }
} else if (!empty($_GET)) {
    $input = $_GET;
} else {
    $input = [];
}

// Ensure input is an array
if (!is_array($input)) {
    respond("error", "Request must be JSON object.", null, 400);
}

// Verify action parameter
if (empty($input['action'])) {
    respond("error", "Missing action parameter.", null, 400);
}

$action = strtolower(trim($input['action']));

// =============================
// ACTION HANDLERS
// =============================
switch ($action) {

    // CREATE TABLE DYNAMICALLY
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

    // INSERT DATA
    case 'insert':
        if (!isset($input['table']) || !isset($input['data'])) {
            respond("error", "Missing table or data.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        if (!is_array($data)) {
            respond("error", "Data must be an array.", null, 400);
        }

        $upsert = isset($input['upsert']) && $input['upsert'];
        $onConflict = isset($input['onConflict']) ? $input['onConflict'] : null;

        if ($upsert && $onConflict === 'user_id' && isset($data['user_id'])) {
            $existsResult = $conn->query("SELECT id FROM `$table` WHERE user_id = '" . $conn->real_escape_string($data['user_id']) . "' LIMIT 1");
            if ($existsResult->num_rows > 0) {
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

        $columns = implode("`, `", array_keys($data));
        $values = implode("', '", array_map([$conn, 'real_escape_string'], array_values($data)));
        $sql = "INSERT INTO `$table` (`$columns`) VALUES ('$values')";

        if ($conn->query($sql)) {
            respond("success", "Record inserted successfully.", ["id" => $conn->insert_id]);
        } else {
            respond("error", "Insert failed: " . $conn->error, null, 500);
        }
        break;

    // READ / SELECT DATA
    case 'select':
        if (!isset($input['table'])) {
            respond("error", "Missing table name.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $where = "";
        $orderBy = "";
        $limit = "";

        if (isset($input['where'])) {
            $where = "WHERE " . $input['where'];
        } else if (isset($input['conditions'])) {
            $where = buildWhereClause($input['conditions']);
        }

        if (isset($input['order'])) {
            $orderBy = "ORDER BY " . $input['order'];
        }

        if (isset($input['limit'])) {
            $limit = "LIMIT " . intval($input['limit']);
        }

        $sql = "SELECT * FROM `$table` $where $orderBy $limit";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $rows = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;

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

    // UPDATE DATA
    case 'update':
        if (!isset($input['table']) || !isset($input['data']) || !isset($input['where'])) {
            respond("error", "Missing table, data, or where condition.", null, 400);
        }

        $table = $conn->real_escape_string($input['table']);
        $data = $input['data'];
        $updates = [];

        foreach ($data as $key => $value) {
            $escapedKey = $conn->real_escape_string($key);
            if ($value === null || $value === 'null') {
                $updates[] = "`$escapedKey` = NULL";
            } else {
                $updates[] = "`$escapedKey` = '" . $conn->real_escape_string($value) . "'";
            }
        }

        $sql = "UPDATE `$table` SET " . implode(", ", $updates) . " WHERE " . $input['where'];

        if ($conn->query($sql)) {
            respond("success", "Record updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Update failed: " . $conn->error, null, 500);
        }
        break;

    // DELETE DATA
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

    // SEED TABLE WITH SAMPLE DATA
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

    // HEALTH CHECK ACTION
    case 'health_check':
        logEvent('health_check', ['status' => 'success']);
        respond("success", "API is healthy and responding correctly.");
        break;

    // AUTH: LOGIN
    case 'login':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('login_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];

        logEvent('login_attempt', ['email' => $email]);

        $stmt = $conn->prepare("SELECT id, email, first_name, last_name, password_hash, status FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if (!$result || $result->num_rows === 0) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'user_not_found']);
            respond("error", "Invalid email or password.", null, 401);
        }

        $user = $result->fetch_assoc();
        $stmt->close();

        if (!password_verify($password, $user['password_hash'])) {
            logEvent('login_failed', ['email' => $email, 'reason' => 'invalid_password']);
            respond("error", "Invalid email or password.", null, 401);
        }

        if ($user['status'] !== 'active') {
            logEvent('login_failed', ['email' => $email, 'reason' => 'inactive_account', 'status' => $user['status']]);
            respond("error", "User account is not active.", null, 403);
        }

        $token = base64_encode(json_encode([
            "id" => $user['id'],
            "email" => $user['email'],
            "ts" => time(),
            "exp" => time() + (7 * 24 * 60 * 60)
        ]));

        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("UPDATE users SET last_login = ? WHERE id = ?");
        $stmt->bind_param("ss", $now, $user['id']);
        $stmt->execute();
        $stmt->close();

        $stmt = $conn->prepare("SELECT user_type FROM user_profiles WHERE user_id = ? LIMIT 1");
        $stmt->bind_param("s", $user['id']);
        $stmt->execute();
        $profileResult = $stmt->get_result();
        $profile = $profileResult->fetch_assoc();
        $stmt->close();

        logEvent('login_success', [
            'email' => $user['email'],
            'user_id' => $user['id'],
            'user_type' => $profile['user_type'] ?? 'client'
        ]);

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

    // AUTH: SIGNUP
    case 'signup':
        if (!isset($input['email']) || !isset($input['password'])) {
            logEvent('signup_failed', ['reason' => 'missing_credentials']);
            respond("error", "Missing email or password.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $password = $input['password'];
        $firstName = isset($input['first_name']) ? $conn->real_escape_string($input['first_name']) : '';
        $lastName = isset($input['last_name']) ? $conn->real_escape_string($input['last_name']) : '';
        $phone = isset($input['phone']) ? $conn->real_escape_string($input['phone']) : NULL;
        $country = isset($input['country']) ? $conn->real_escape_string($input['country']) : NULL;
        $userType = isset($input['user_type']) ? $conn->real_escape_string($input['user_type']) : 'client';

        logEvent('signup_attempt', ['email' => $email, 'user_type' => $userType]);

        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $checkResult = $stmt->get_result();
        if ($checkResult->num_rows > 0) {
            $stmt->close();
            logEvent('signup_failed', ['email' => $email, 'reason' => 'user_already_exists']);
            respond("error", "User already exists.", null, 409);
        }
        $stmt->close();

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
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
            respond("error", "Failed to create user: " . $error, null, 500);
        }
        $stmt->close();

        $profileId = 'profile_' . uniqid();
        $fullName = trim($firstName . ' ' . $lastName);

        $stmt = $conn->prepare("
            INSERT INTO user_profiles (id, user_id, user_type, full_name, phone_number, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $profileId, $userId, $userType, $fullName, $phone, $now);
        $stmt->execute();
        $stmt->close();

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
        logEvent('migration_started');
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
            logEvent('migration_success', ['table' => 'users']);
            respond("success", "Migration successful: users table created or already exists.");
        } else {
            logEvent('migration_failed', ['table' => 'users', 'error' => $conn->error]);
            respond("error", "Migration failed: " . $conn->error, null, 500);
        }

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
            logEvent('migration_success', ['table' => 'password_reset_tokens']);
            respond("success", "Migration successful: users and password_reset_tokens tables created or already exist.");
        } else {
            logEvent('migration_failed', ['table' => 'password_reset_tokens', 'error' => $conn->error]);
            respond("error", "Migration failed: " . $conn->error, null, 500);
        }
        break;

    // MIGRATE: Create audit-fixed missing tables
    case 'apply_audit_migration':
        logEvent('audit_migration_started');

        $migrations = [
            'trainer_availability' => "
                CREATE TABLE IF NOT EXISTS `trainer_availability` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `slots` JSON NOT NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_trainer_availability_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  UNIQUE KEY `uq_trainer_availability` (`trainer_id`),
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_updated_at` (`updated_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'transactions' => "
                CREATE TABLE IF NOT EXISTS `transactions` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL,
                  `type` VARCHAR(50) NOT NULL,
                  `amount` DECIMAL(15, 2) NOT NULL,
                  `balance_before` DECIMAL(15, 2),
                  `balance_after` DECIMAL(15, 2),
                  `reference` VARCHAR(255),
                  `description` TEXT,
                  `status` VARCHAR(50) DEFAULT 'completed',
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_transactions_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_type` (`type`),
                  INDEX `idx_created_at` (`created_at` DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'payout_requests' => "
                CREATE TABLE IF NOT EXISTS `payout_requests` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `amount` DECIMAL(15, 2) NOT NULL,
                  `status` VARCHAR(50) DEFAULT 'pending',
                  `payment_method_id` VARCHAR(36),
                  `notes` TEXT,
                  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `processed_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_payout_requests_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'reported_issues' => "
                CREATE TABLE IF NOT EXISTS `reported_issues` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL,
                  `trainer_id` VARCHAR(36),
                  `booking_reference` VARCHAR(100),
                  `complaint_type` VARCHAR(100),
                  `title` VARCHAR(255),
                  `description` TEXT NOT NULL,
                  `status` VARCHAR(50) DEFAULT 'open',
                  `priority` VARCHAR(50) DEFAULT 'normal',
                  `attachments` JSON,
                  `resolution` TEXT,
                  `resolved_at` TIMESTAMP NULL,
                  `assigned_to` VARCHAR(36),
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_reported_issues_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'user_wallets' => "
                CREATE TABLE IF NOT EXISTS `user_wallets` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `user_id` VARCHAR(36) NOT NULL UNIQUE,
                  `balance` DECIMAL(15, 2) DEFAULT 0,
                  `pending_balance` DECIMAL(15, 2) DEFAULT 0,
                  `total_earned` DECIMAL(15, 2) DEFAULT 0,
                  `total_spent` DECIMAL(15, 2) DEFAULT 0,
                  `total_refunded` DECIMAL(15, 2) DEFAULT 0,
                  `currency` VARCHAR(3) DEFAULT 'KES',
                  `last_transaction_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_user_wallets_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_user_id` (`user_id`),
                  INDEX `idx_balance` (`balance`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'promotion_requests' => "
                CREATE TABLE IF NOT EXISTS `promotion_requests` (
                  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                  `trainer_id` VARCHAR(36) NOT NULL,
                  `promotion_type` VARCHAR(100),
                  `status` VARCHAR(50) DEFAULT 'pending',
                  `duration_days` INT,
                  `commission_rate` DECIMAL(5, 2) DEFAULT 0,
                  `cost` DECIMAL(15, 2) DEFAULT 0,
                  `features` JSON,
                  `approved_by` VARCHAR(36),
                  `started_at` TIMESTAMP NULL,
                  `expires_at` TIMESTAMP NULL,
                  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `approved_at` TIMESTAMP NULL,
                  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  CONSTRAINT `fk_promotion_requests_trainer_id`
                    FOREIGN KEY (`trainer_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                  INDEX `idx_trainer_id` (`trainer_id`),
                  INDEX `idx_status` (`status`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            "
        ];

        $successCount = 0;
        $failureCount = 0;
        $messages = [];

        foreach ($migrations as $tableName => $sql) {
            if ($conn->query($sql)) {
                $successCount++;
                $messages[] = "✓ $tableName created";
                logEvent('audit_migration_success', ['table' => $tableName]);
            } else {
                $failureCount++;
                $messages[] = "✗ $tableName failed: " . $conn->error;
                logEvent('audit_migration_failed', ['table' => $tableName, 'error' => $conn->error]);
            }
        }

        if ($failureCount === 0) {
            respond("success", "All audit migrations applied successfully.", [
                "created" => $successCount,
                "failed" => $failureCount,
                "messages" => $messages
            ]);
        } else {
            respond("success", "Audit migration completed with $failureCount error(s).", [
                "created" => $successCount,
                "failed" => $failureCount,
                "messages" => $messages
            ]);
        }
        break;

    // SEED_USERS: Create test users
    case 'seed_users':
        logEvent('seed_users_started');
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
            respond("success", $message . " Errors: " . implode("; ", $errors), ["seeded" => $seeded, "skipped" => $skipped]);
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

            $userId = 'user_' . uniqid();
            $profileId = 'profile_' . uniqid();
            $passwordHash = password_hash($user['password'], PASSWORD_BCRYPT);
            $fullName = trim($user['first_name'] . ' ' . $user['last_name']);

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

    // REQUEST PASSWORD RESET
    case 'request_password_reset':
        if (!isset($input['email'])) {
            respond("error", "Email is required.", null, 400);
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

        $resetToken = bin2hex(random_bytes(32));
        $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $stmt = $conn->prepare("INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->bind_param("sss", $user['id'], $resetToken, $tokenExpiry);

        if ($stmt->execute()) {
            error_log("Password reset token generated for: " . $email);
            $stmt->close();

            respond("success", "Password reset link has been sent to your email.", [
                "email" => $email,
                "token" => $resetToken
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to generate reset link. Please try again.", null, 500);
        }
        break;

    // RESET PASSWORD WITH TOKEN
    case 'reset_password_with_token':
        if (!isset($input['email']) || !isset($input['token']) || !isset($input['new_password'])) {
            respond("error", "Email, token, and new password are required.", null, 400);
        }

        $email = $conn->real_escape_string($input['email']);
        $token = $conn->real_escape_string($input['token']);
        $newPassword = $input['new_password'];

        if (strlen($newPassword) < 8) {
            respond("error", "Password must be at least 8 characters long.", null, 400);
        }

        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $userResult = $stmt->get_result();

        if (!$userResult || $userResult->num_rows === 0) {
            respond("error", "User not found.", null, 404);
        }

        $user = $userResult->fetch_assoc();
        $stmt->close();

        $now = date('Y-m-d H:i:s');
        $stmt = $conn->prepare("SELECT id FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > ? LIMIT 1");
        $stmt->bind_param("sss", $user['id'], $token, $now);
        $stmt->execute();
        $tokenResult = $stmt->get_result();

        if (!$tokenResult || $tokenResult->num_rows === 0) {
            error_log("Invalid or expired password reset token for: " . $email);
            respond("error", "Reset link is invalid or has expired.", null, 401);
        }

        $stmt->close();

        $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        $stmt = $conn->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("ss", $passwordHash, $user['id']);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to update password. Please try again.", null, 500);
        }

        $stmt->close();

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
            respond("error", "Password must be at least 6 characters long.", null, 400);
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

    // APPROVE TRAINER
    case 'approve_trainer':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $stmt = $conn->prepare("UPDATE user_profiles SET is_approved = 1 WHERE user_id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_approved', ['user_id' => $userId]);
            respond("success", "Trainer approved successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve trainer: " . $conn->error, null, 500);
        }
        break;

    // REJECT TRAINER
    case 'reject_trainer':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        // Delete from user_profiles
        $stmt = $conn->prepare("DELETE FROM user_profiles WHERE user_id = ?");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $stmt->close();

        // Delete from users
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('trainer_rejected', ['user_id' => $userId]);
            respond("success", "Trainer rejected and deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to reject trainer: " . $conn->error, null, 500);
        }
        break;

    // DELETE USER
    case 'delete_user':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        // Delete from user_profiles
        $stmt = $conn->prepare("DELETE FROM user_profiles WHERE user_id = ?");
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $stmt->close();

        // Delete from users
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("s", $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('user_deleted', ['user_id' => $userId]);
            respond("success", "User deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to delete user: " . $conn->error, null, 500);
        }
        break;

    // UPDATE USER TYPE
    case 'update_user_type':
        if (!isset($input['user_id']) || !isset($input['user_type'])) {
            respond("error", "Missing user_id or user_type.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $userType = $conn->real_escape_string($input['user_type']);

        $stmt = $conn->prepare("UPDATE user_profiles SET user_type = ? WHERE user_id = ?");
        $stmt->bind_param("ss", $userType, $userId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('user_type_updated', ['user_id' => $userId, 'new_type' => $userType]);
            respond("success", "User type updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update user type: " . $conn->error, null, 500);
        }
        break;

    // GET CATEGORIES
    case 'get_categories':
        $stmt = $conn->prepare("SELECT id, name, icon, description, created_at FROM categories ORDER BY created_at DESC");

        if ($stmt->execute()) {
            $result = $stmt->get_result();
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row;
            }
            $stmt->close();
            respond("success", "Categories fetched successfully.", ["data" => $categories]);
        } else {
            $stmt->close();
            respond("error", "Failed to fetch categories: " . $conn->error, null, 500);
        }
        break;

    // ADD CATEGORY
    case 'add_category':
        if (!isset($input['name'])) {
            respond("error", "Missing name.", null, 400);
        }

        $name = $conn->real_escape_string($input['name']);
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : '';
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : '';
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("INSERT INTO categories (name, icon, description, created_at) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $name, $icon, $description, $now);

        if ($stmt->execute()) {
            $categoryId = $conn->insert_id;
            $stmt->close();
            logEvent('category_added', ['category_id' => $categoryId, 'name' => $name]);
            respond("success", "Category added successfully.", ["id" => $categoryId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add category: " . $conn->error, null, 500);
        }
        break;

    // UPDATE CATEGORY
    case 'update_category':
        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = $conn->real_escape_string($input['id']);
        $name = isset($input['name']) ? $conn->real_escape_string($input['name']) : null;
        $icon = isset($input['icon']) ? $conn->real_escape_string($input['icon']) : null;
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : null;

        $updates = [];
        $params = [];
        $types = "";

        if ($name !== null) {
            $updates[] = "name = ?";
            $params[] = $name;
            $types .= "s";
        }
        if ($icon !== null) {
            $updates[] = "icon = ?";
            $params[] = $icon;
            $types .= "s";
        }
        if ($description !== null) {
            $updates[] = "description = ?";
            $params[] = $description;
            $types .= "s";
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $categoryId;
        $types .= "i";

        $sql = "UPDATE categories SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('category_updated', ['category_id' => $categoryId]);
            respond("success", "Category updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update category: " . $conn->error, null, 500);
        }
        break;

    // DELETE CATEGORY
    case 'delete_category':
        if (!isset($input['id'])) {
            respond("error", "Missing id.", null, 400);
        }

        $categoryId = $conn->real_escape_string($input['id']);

        $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->bind_param("i", $categoryId);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('category_deleted', ['category_id' => $categoryId]);
            respond("success", "Category deleted successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to delete category: " . $conn->error, null, 500);
        }
        break;

    // =============================
    // CUSTOM ACTIONS: Client Portal
    // =============================

    // INSERT REPORTED ISSUE
    case 'issue_insert':
        if (!isset($input['user_id']) || !isset($input['description'])) {
            respond("error", "Missing user_id or description.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : NULL;
        $bookingReference = isset($input['booking_reference']) ? $conn->real_escape_string($input['booking_reference']) : NULL;
        $complaintType = isset($input['complaint_type']) ? $conn->real_escape_string($input['complaint_type']) : NULL;
        $title = isset($input['title']) ? $conn->real_escape_string($input['title']) : 'Support Issue';
        $description = $conn->real_escape_string($input['description']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'open';
        $priority = isset($input['priority']) ? $conn->real_escape_string($input['priority']) : 'normal';
        $issueId = 'issue_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO reported_issues (
                id, user_id, trainer_id, booking_reference, complaint_type,
                title, description, status, priority, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssssssssss", $issueId, $userId, $trainerId, $bookingReference, $complaintType, $title, $description, $status, $priority, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('issue_reported', ['issue_id' => $issueId, 'user_id' => $userId]);
            respond("success", "Issue reported successfully.", ["id" => $issueId]);
        } else {
            $stmt->close();
            respond("error", "Failed to report issue: " . $conn->error, null, 500);
        }
        break;

    // INSERT REVIEW
    case 'review_insert':
        if (!isset($input['trainer_id']) || !isset($input['client_id']) || !isset($input['rating'])) {
            respond("error", "Missing trainer_id, client_id, or rating.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $clientId = $conn->real_escape_string($input['client_id']);
        $rating = floatval($input['rating']);
        $comment = isset($input['comment']) ? $conn->real_escape_string($input['comment']) : '';
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : NULL;
        $reviewId = 'review_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO reviews (
                id, trainer_id, client_id, booking_id, rating, comment, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssdsss", $reviewId, $trainerId, $clientId, $bookingId, $rating, $comment, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('review_added', ['review_id' => $reviewId, 'trainer_id' => $trainerId]);
            respond("success", "Review added successfully.", ["id" => $reviewId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add review: " . $conn->error, null, 500);
        }
        break;

    // INSERT PAYOUT REQUEST
    case 'payout_insert':
        if (!isset($input['trainer_id']) || !isset($input['amount'])) {
            respond("error", "Missing trainer_id or amount.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $amount = floatval($input['amount']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $payoutId = 'payout_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO payout_requests (
                id, trainer_id, amount, status, requested_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sdsssss", $payoutId, $trainerId, $amount, $status, $now, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payout_requested', ['payout_id' => $payoutId, 'trainer_id' => $trainerId, 'amount' => $amount]);
            respond("success", "Payout request submitted successfully.", ["id" => $payoutId]);
        } else {
            $stmt->close();
            respond("error", "Failed to submit payout request: " . $conn->error, null, 500);
        }
        break;

    // GET PAYMENTS (for earnings)
    case 'payments_get':
        if (!isset($input['trainer_id'])) {
            respond("error", "Missing trainer_id.", null, 400);
        }

        $trainerId = $conn->real_escape_string($input['trainer_id']);

        $sql = "SELECT * FROM payments WHERE trainer_id = '$trainerId' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $payments = [];
        while ($row = $result->fetch_assoc()) {
            $payments[] = $row;
        }

        respond("success", "Payments fetched successfully.", ["data" => $payments]);
        break;

    // INSERT PAYMENT
    case 'payment_insert':
        if (!isset($input['client_id']) || !isset($input['trainer_id']) || !isset($input['amount'])) {
            respond("error", "Missing client_id, trainer_id, or amount.", null, 400);
        }

        $clientId = $conn->real_escape_string($input['client_id']);
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $amount = floatval($input['amount']);
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'completed';
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : NULL;
        $paymentId = 'payment_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO payments (
                id, client_id, trainer_id, booking_id, amount, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssssssss", $paymentId, $clientId, $trainerId, $bookingId, $amount, $status, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payment_recorded', ['payment_id' => $paymentId, 'amount' => $amount]);
            respond("success", "Payment recorded successfully.", ["id" => $paymentId]);
        } else {
            $stmt->close();
            respond("error", "Failed to record payment: " . $conn->error, null, 500);
        }
        break;

    // GET PROFILE (custom wrapper)
    case 'profile_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM user_profiles WHERE user_id = '$userId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        if ($result->num_rows === 0) {
            respond("success", "Profile not found.", ["data" => null]);
        }

        $profile = $result->fetch_assoc();
        respond("success", "Profile fetched successfully.", ["data" => $profile]);
        break;

    // UPDATE PROFILE (custom wrapper)
    case 'profile_update':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $updates = [];
        $params = [];
        $types = "";

        foreach ($input as $key => $value) {
            if ($key === 'user_id' || $key === 'action') continue;
            if ($value === null) continue;

            $safeKey = $conn->real_escape_string($key);
            if (is_array($value) || is_object($value)) {
                $updates[] = "`$safeKey` = ?";
                $params[] = json_encode($value);
                $types .= "s";
            } else {
                $updates[] = "`$safeKey` = ?";
                $params[] = $value;
                $types .= is_numeric($value) && strpos($value, '.') === false ? "i" : "s";
            }
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $userId;
        $types .= "s";

        $sql = "UPDATE user_profiles SET " . implode(", ", $updates) . " WHERE user_id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('profile_updated', ['user_id' => $userId]);
            respond("success", "Profile updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update profile: " . $conn->error, null, 500);
        }
        break;

    // GET PAYMENT METHODS
    case 'payment_methods_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM payment_methods WHERE user_id = '$userId' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $methods = [];
        while ($row = $result->fetch_assoc()) {
            $methods[] = $row;
        }

        respond("success", "Payment methods fetched successfully.", ["data" => $methods]);
        break;

    // GET MESSAGES (supports both trainer_id/client_id and user_id formats)
    case 'messages_get':
        if (!isset($input['user_id']) && !isset($input['trainer_id']) && !isset($input['client_id'])) {
            respond("error", "Missing user_id, trainer_id, or client_id.", null, 400);
        }

        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $clientId = isset($input['client_id']) ? $conn->real_escape_string($input['client_id']) : null;
        $userId = isset($input['user_id']) ? $conn->real_escape_string($input['user_id']) : null;

        $where = "1=1";
        if ($trainerId && $clientId) {
            $where = "(trainer_id = '$trainerId' AND client_id = '$clientId') OR (trainer_id = '$clientId' AND client_id = '$trainerId')";
        } else if ($trainerId) {
            $where = "(trainer_id = '$trainerId' OR sender_id = '$trainerId' OR recipient_id = '$trainerId')";
        } else if ($clientId) {
            $where = "(client_id = '$clientId' OR sender_id = '$clientId' OR recipient_id = '$clientId')";
        } else if ($userId) {
            $where = "sender_id = '$userId' OR recipient_id = '$userId'";
        }

        $sql = "SELECT * FROM messages WHERE $where ORDER BY created_at DESC LIMIT 100";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $messages = [];
        while ($row = $result->fetch_assoc()) {
            $messages[] = $row;
        }

        respond("success", "Messages fetched successfully.", ["data" => $messages]);
        break;

    // INSERT MESSAGE (supports both trainer_id/client_id and sender_id/recipient_id formats)
    case 'message_insert':
        if (!isset($input['content'])) {
            respond("error", "Missing content.", null, 400);
        }

        $senderId = null;
        $recipientId = null;
        $trainerId = null;
        $clientId = null;

        if (isset($input['sender_id']) && isset($input['recipient_id'])) {
            $senderId = $conn->real_escape_string($input['sender_id']);
            $recipientId = $conn->real_escape_string($input['recipient_id']);
        } else if (isset($input['trainer_id']) && isset($input['client_id'])) {
            $trainerId = $conn->real_escape_string($input['trainer_id']);
            $clientId = $conn->real_escape_string($input['client_id']);
            $senderId = isset($input['client_id']) ? $clientId : $trainerId;
            $recipientId = isset($input['trainer_id']) ? $trainerId : $clientId;
        } else {
            respond("error", "Missing sender_id/recipient_id or trainer_id/client_id.", null, 400);
        }

        $content = $conn->real_escape_string($input['content']);
        $readByTrainer = isset($input['read_by_trainer']) ? intval($input['read_by_trainer']) : 0;
        $readByClient = isset($input['read_by_client']) ? intval($input['read_by_client']) : 0;
        $messageId = 'msg_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO messages (
                id, sender_id, recipient_id, trainer_id, client_id, content,
                read_by_trainer, read_by_client, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssssssss", $messageId, $senderId, $recipientId, $trainerId, $clientId, $content, $readByTrainer, $readByClient, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('message_sent', ['message_id' => $messageId, 'sender_id' => $senderId]);
            respond("success", "Message sent successfully.", ["id" => $messageId]);
        } else {
            $stmt->close();
            respond("error", "Failed to send message: " . $conn->error, null, 500);
        }
        break;

    // GET NOTIFICATIONS
    case 'notifications_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $sql = "SELECT * FROM notifications WHERE user_id = '$userId' ORDER BY created_at DESC LIMIT 50";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $notifications = [];
        while ($row = $result->fetch_assoc()) {
            $notifications[] = $row;
        }

        respond("success", "Notifications fetched successfully.", ["data" => $notifications]);
        break;

    // INSERT NOTIFICATIONS
    case 'notifications_insert':
        if (!isset($input['notifications']) || !is_array($input['notifications'])) {
            respond("error", "Missing notifications array.", null, 400);
        }

        $notifications = $input['notifications'];
        $inserted = 0;
        $now = date('Y-m-d H:i:s');

        foreach ($notifications as $notif) {
            $userId = isset($notif['user_id']) ? $conn->real_escape_string($notif['user_id']) : null;
            $title = isset($notif['title']) ? $conn->real_escape_string($notif['title']) : '';
            $message = isset($notif['message']) ? $conn->real_escape_string($notif['message']) : '';
            $body = isset($notif['body']) ? $conn->real_escape_string($notif['body']) : $message;
            $type = isset($notif['type']) ? $conn->real_escape_string($notif['type']) : 'info';
            $notifId = 'notif_' . uniqid();

            if (!$userId) continue;

            $stmt = $conn->prepare("
                INSERT INTO notifications (
                    id, user_id, title, body, message, type, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->bind_param("ssssssss", $notifId, $userId, $title, $body, $body, $type, $now, $now);

            if ($stmt->execute()) {
                $inserted++;
            }
            $stmt->close();
        }

        respond("success", "Notifications created successfully.", ["inserted" => $inserted]);
        break;

    // GET REFERRAL
    case 'referral_get':
        if (!isset($input['code'])) {
            respond("error", "Missing code.", null, 400);
        }

        $code = $conn->real_escape_string($input['code']);
        $sql = "SELECT * FROM referrals WHERE code = '$code' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        if ($result->num_rows === 0) {
            respond("success", "Referral not found.", ["data" => null]);
        }

        $referral = $result->fetch_assoc();
        respond("success", "Referral fetched successfully.", ["data" => $referral]);
        break;

    // UPDATE REFERRAL
    case 'referral_update':
        if (!isset($input['id'])) {
            respond("error", "Missing referral id.", null, 400);
        }

        $referralId = $conn->real_escape_string($input['id']);
        $updates = [];
        $params = [];
        $types = "";

        if (isset($input['referee_id'])) {
            $updates[] = "referee_id = ?";
            $params[] = $conn->real_escape_string($input['referee_id']);
            $types .= "s";
        }
        if (isset($input['discount_used'])) {
            $updates[] = "discount_used = ?";
            $params[] = $input['discount_used'] ? 1 : 0;
            $types .= "i";
        }
        if (isset($input['discount_amount'])) {
            $updates[] = "discount_amount = ?";
            $params[] = floatval($input['discount_amount']);
            $types .= "d";
        }

        if (empty($updates)) {
            respond("error", "No fields to update.", null, 400);
        }

        $params[] = $referralId;
        $types .= "s";

        $sql = "UPDATE referrals SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $conn->prepare($sql);

        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('referral_updated', ['referral_id' => $referralId]);
            respond("success", "Referral updated successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            $stmt->close();
            respond("error", "Failed to update referral: " . $conn->error, null, 500);
        }
        break;

    // INSERT BOOKING (custom action wrapper)
    case 'booking_insert':
        if (!isset($input['client_id']) || !isset($input['trainer_id']) || !isset($input['session_date']) || !isset($input['session_time'])) {
            respond("error", "Missing required booking fields (client_id, trainer_id, session_date, session_time).", null, 400);
        }

        $clientId = $conn->real_escape_string($input['client_id']);
        $trainerId = $conn->real_escape_string($input['trainer_id']);
        $sessionDate = $conn->real_escape_string($input['session_date']);
        $sessionTime = $conn->real_escape_string($input['session_time']);
        $durationHours = isset($input['duration_hours']) ? intval($input['duration_hours']) : 1;
        $totalSessions = isset($input['total_sessions']) ? intval($input['total_sessions']) : 1;
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $totalAmount = isset($input['total_amount']) ? floatval($input['total_amount']) : 0;
        $notes = isset($input['notes']) ? $conn->real_escape_string($input['notes']) : NULL;
        $clientLocationLabel = isset($input['client_location_label']) ? $conn->real_escape_string($input['client_location_label']) : NULL;
        $clientLocationLat = isset($input['client_location_lat']) ? floatval($input['client_location_lat']) : NULL;
        $clientLocationLng = isset($input['client_location_lng']) ? floatval($input['client_location_lng']) : NULL;
        $bookingId = 'booking_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO bookings (
                id, client_id, trainer_id, session_date, session_time, duration_hours,
                total_sessions, status, total_amount, notes, client_location_label,
                client_location_lat, client_location_lng, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("sssssiiisddsss", $bookingId, $clientId, $trainerId, $sessionDate, $sessionTime, $durationHours, $totalSessions, $status, $totalAmount, $notes, $clientLocationLabel, $clientLocationLat, $clientLocationLng, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('booking_created', ['booking_id' => $bookingId, 'client_id' => $clientId, 'trainer_id' => $trainerId]);
            respond("success", "Booking created successfully.", ["id" => $bookingId]);
        } else {
            $stmt->close();
            respond("error", "Failed to create booking: " . $conn->error, null, 500);
        }
        break;

    // MARK MESSAGES AS READ
    case 'messages_mark_read':
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $clientId = isset($input['client_id']) ? $conn->real_escape_string($input['client_id']) : null;
        $markReadByTrainer = isset($input['read_by_trainer']) ? intval($input['read_by_trainer']) : 0;
        $markReadByClient = isset($input['read_by_client']) ? intval($input['read_by_client']) : 0;

        if (!$trainerId && !$clientId) {
            respond("error", "Missing trainer_id or client_id.", null, 400);
        }

        $sql = "UPDATE messages SET ";
        $updates = [];

        if ($markReadByTrainer) {
            $updates[] = "read_by_trainer = 1";
        }
        if ($markReadByClient) {
            $updates[] = "read_by_client = 1";
        }

        if (empty($updates)) {
            respond("error", "No read status specified.", null, 400);
        }

        $sql .= implode(", ", $updates) . " WHERE ";
        $conditions = [];

        if ($trainerId) {
            $conditions[] = "(trainer_id = '$trainerId' OR sender_id = '$trainerId' OR recipient_id = '$trainerId')";
        }
        if ($clientId) {
            $conditions[] = "(client_id = '$clientId' OR sender_id = '$clientId' OR recipient_id = '$clientId')";
        }

        $sql .= implode(" OR ", $conditions);

        if ($conn->query($sql)) {
            logEvent('messages_marked_read', ['trainer_id' => $trainerId, 'client_id' => $clientId]);
            respond("success", "Messages marked as read successfully.", ["affected_rows" => $conn->affected_rows]);
        } else {
            respond("error", "Failed to mark messages as read: " . $conn->error, null, 500);
        }
        break;

    // INSERT PAYMENT METHOD
    case 'payment_method_insert':
        if (!isset($input['user_id']) || !isset($input['method'])) {
            respond("error", "Missing user_id or method.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $method = $conn->real_escape_string($input['method']);
        $details = isset($input['details']) ? json_encode($input['details']) : NULL;
        $methodId = 'method_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO payment_methods (
                id, user_id, method, details, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param("ssssss", $methodId, $userId, $method, $details, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();
            logEvent('payment_method_added', ['method_id' => $methodId, 'user_id' => $userId]);
            respond("success", "Payment method added successfully.", ["id" => $methodId]);
        } else {
            $stmt->close();
            respond("error", "Failed to add payment method: " . $conn->error, null, 500);
        }
        break;

    // GET PROFILES BY USER TYPE
    case 'profiles_get_by_type':
        if (!isset($input['user_type'])) {
            respond("error", "Missing user_type.", null, 400);
        }

        $userType = $conn->real_escape_string($input['user_type']);
        $sql = "SELECT * FROM user_profiles WHERE user_type = '$userType' ORDER BY created_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $profiles = [];
        while ($row = $result->fetch_assoc()) {
            $profiles[] = $row;
        }

        respond("success", "Profiles fetched successfully.", ["data" => $profiles]);
        break;

    // GET PAYOUT REQUESTS (for admin)
    case 'payout_requests_get':
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : 'pending';
        $sql = "SELECT pr.*, up.full_name, up.phone, up.location_label FROM payout_requests pr
                LEFT JOIN user_profiles up ON pr.trainer_id = up.user_id
                WHERE pr.status = '$status'
                ORDER BY pr.requested_at DESC";
        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $requests = [];
        while ($row = $result->fetch_assoc()) {
            $requests[] = $row;
        }

        respond("success", "Payout requests fetched successfully.", ["data" => $requests]);
        break;

    // APPROVE PAYOUT REQUEST AND INITIATE B2C
    case 'payout_request_approve':
        if (!isset($input['payout_request_id'])) {
            respond("error", "Missing payout_request_id.", null, 400);
        }

        $payoutRequestId = $conn->real_escape_string($input['payout_request_id']);
        $commissionPercentage = isset($input['commission_percentage']) ? floatval($input['commission_percentage']) : 0;

        // Get the payout request
        $sql = "SELECT * FROM payout_requests WHERE id = '$payoutRequestId' LIMIT 1";
        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "Payout request not found.", null, 404);
        }

        $request = $result->fetch_assoc();
        $trainerId = $request['trainer_id'];
        $requestedAmount = floatval($request['amount']);

        // Calculate net amount after commission
        $commission = ($requestedAmount * $commissionPercentage) / 100;
        $netAmount = $requestedAmount - $commission;

        // Get trainer's phone number
        $phoneQuery = $conn->query("SELECT phone FROM user_profiles WHERE user_id = '$trainerId'");
        if (!$phoneQuery || $phoneQuery->num_rows === 0) {
            respond("error", "Trainer phone not found.", null, 404);
        }

        $trainerData = $phoneQuery->fetch_assoc();
        $phoneNumber = $trainerData['phone'];

        // Create B2C payment record
        $b2cId = 'b2c_' . uniqid();
        $referenceId = 'payout_' . uniqid();
        $now = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            INSERT INTO b2c_payments (
                id, user_id, user_type, phone_number, amount, reference_id, status, initiated_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $userType = 'trainer';
        $status = 'pending';

        $stmt->bind_param("ssssdssss", $b2cId, $trainerId, $userType, $phoneNumber, $netAmount, $referenceId, $status, $now, $now);

        if ($stmt->execute()) {
            $stmt->close();

            // Update payout request status
            $updateStmt = $conn->prepare("
                UPDATE payout_requests
                SET status = ?, b2c_payment_id = ?, commission = ?, net_amount = ?, updated_at = NOW()
                WHERE id = ?
            ");

            $approvedStatus = 'approved';
            $updateStmt->bind_param("ssdds", $approvedStatus, $b2cId, $commission, $netAmount, $payoutRequestId);
            $updateStmt->execute();
            $updateStmt->close();

            logEvent('payout_request_approved', [
                'payout_request_id' => $payoutRequestId,
                'trainer_id' => $trainerId,
                'b2c_payment_id' => $b2cId,
                'net_amount' => $netAmount,
                'commission' => $commission
            ]);

            respond("success", "Payout request approved. B2C payment created.", [
                "b2c_payment_id" => $b2cId,
                "reference_id" => $referenceId,
                "net_amount" => $netAmount,
                "commission" => $commission
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to approve payout: " . $conn->error, null, 500);
        }
        break;

    // SAVE ADMIN SETTINGS (including M-Pesa credentials)
    case 'settings_save':
        try {
            // Verify admin token if required
            $adminToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;
            // For now, allow saving if properly structured

            if (isset($input['settings']) && is_array($input['settings'])) {
                $settings = $input['settings'];

                // Extract and save M-Pesa credentials if present
                if (isset($settings['mpesa']) && is_array($settings['mpesa'])) {
                    $mpesaCreds = $settings['mpesa'];

                    // Validate required fields
                    if (empty($mpesaCreds['consumerKey']) || empty($mpesaCreds['consumerSecret'])) {
                        respond("error", "M-Pesa credentials incomplete: consumerKey and consumerSecret required.", null, 400);
                    }

                    // Save M-Pesa credentials to database
                    $saveResult = saveMpesaCredentials($mpesaCreds);
                    if (!$saveResult) {
                        respond("error", "Failed to save M-Pesa credentials to database.", null, 500);
                    }

                    logEvent('admin_settings_updated', [
                        'setting' => 'mpesa_credentials',
                        'environment' => $mpesaCreds['environment'] ?? 'unknown'
                    ]);
                }

                respond("success", "Settings saved successfully.", [
                    "saved_at" => date('Y-m-d H:i:s'),
                    "mpesa_configured" => !empty($settings['mpesa']['consumerKey'])
                ]);
            } else {
                respond("error", "Invalid settings format.", null, 400);
            }
        } catch (Exception $e) {
            logEvent('settings_save_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to save settings: " . $e->getMessage(), null, 500);
        }
        break;

    // GET ADMIN SETTINGS (retrieve M-Pesa credentials)
    case 'settings_get':
        try {
            // Retrieve M-Pesa credentials
            $mpesaCreds = getMpesaCredentialsForAdmin();

            respond("success", "Settings retrieved.", [
                "mpesa" => $mpesaCreds,
                "mpesa_source" => $mpesaCreds ? $mpesaCreds['source'] : null
            ]);
        } catch (Exception $e) {
            logEvent('settings_get_error', ['error' => $e->getMessage()]);
            respond("error", "Failed to retrieve settings: " . $e->getMessage(), null, 500);
        }
        break;

    // INITIATE B2C PAYMENT
    case 'b2c_payment_initiate':
        if (!isset($input['b2c_payment_id']) || !isset($input['phone_number']) || !isset($input['amount'])) {
            respond("error", "Missing required fields: b2c_payment_id, phone_number, amount.", null, 400);
        }

        // Validate M-Pesa credentials are configured
        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            respond("error", $credValidation['error'], null, 500);
        }

        $b2cPaymentId = $conn->real_escape_string($input['b2c_payment_id']);
        $phoneNumber = $conn->real_escape_string($input['phone_number']);
        $amount = floatval($input['amount']);

        // Normalize phone number
        $phoneNumber = str_replace(['+', ' ', '-'], '', $phoneNumber);
        if (substr($phoneNumber, 0, 1) !== '2') {
            $phoneNumber = '254' . substr($phoneNumber, -9);
        }

        if (strlen($phoneNumber) !== 12 || !is_numeric($phoneNumber)) {
            respond("error", "Invalid phone number format.", null, 400);
        }

        // Get reference ID for this B2C payment
        $refQuery = $conn->query("SELECT reference_id FROM b2c_payments WHERE id = '$b2cPaymentId'");
        if (!$refQuery || $refQuery->num_rows === 0) {
            respond("error", "B2C payment not found.", null, 404);
        }

        $refData = $refQuery->fetch_assoc();
        $referenceId = $refData['reference_id'];

        // Get server-side credentials (NOT from request body)
        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            respond("error", "M-Pesa credentials not properly configured.", null, 500);
        }

        // Determine callback URLs (uses defaults from mpesa_helper if not configured)
        $resultUrl = $mpesaCreds['result_url'] ?? null;
        $queueTimeoutUrl = $mpesaCreds['result_url'] ?? null;

        // Call M-Pesa API to initiate B2C payment
        $b2cResult = initiateB2CPayment(
            $mpesaCreds,
            $phoneNumber,
            $amount,
            'BusinessPayment',
            'Payout: ' . $referenceId,
            $queueTimeoutUrl,
            $resultUrl
        );

        if (!$b2cResult['success']) {
            logPaymentEvent('b2c_payment_failed', [
                'b2c_payment_id' => $b2cPaymentId,
                'phone' => $phoneNumber,
                'amount' => $amount,
                'error' => $b2cResult['error']
            ]);
            respond("error", $b2cResult['error'], null, 500);
        }

        // Update B2C payment with M-Pesa transaction IDs
        $conversationId = $b2cResult['conversation_id'];
        $originatorConversationId = $b2cResult['originator_conversation_id'];
        $initiatedStatus = 'initiated';

        $updateStmt = $conn->prepare("
            UPDATE b2c_payments
            SET status = ?, conversation_id = ?, originator_conversation_id = ?, updated_at = NOW()
            WHERE id = ?
        ");

        if (!$updateStmt) {
            respond("error", "Failed to update payment: " . $conn->error, null, 500);
        }

        $updateStmt->bind_param("ssss", $initiatedStatus, $conversationId, $originatorConversationId, $b2cPaymentId);

        if (!$updateStmt->execute()) {
            $updateStmt->close();
            respond("error", "Failed to update B2C payment status: " . $conn->error, null, 500);
        }
        $updateStmt->close();

        logPaymentEvent('b2c_payment_initiated', [
            'b2c_payment_id' => $b2cPaymentId,
            'reference_id' => $referenceId,
            'amount' => $amount,
            'phone' => $phoneNumber,
            'conversation_id' => $conversationId,
            'credentials_source' => $mpesaCreds['source']
        ]);

        respond("success", "B2C payment initiated successfully. Waiting for M-Pesa callback.", [
            "b2c_payment_id" => $b2cPaymentId,
            "reference_id" => $referenceId,
            "conversation_id" => $conversationId,
            "status" => "initiated"
        ]);
        break;

    // GET B2C PAYMENT STATUS
    case 'b2c_payment_status':
        if (!isset($input['b2c_payment_id'])) {
            respond("error", "Missing b2c_payment_id.", null, 400);
        }

        $b2cPaymentId = $conn->real_escape_string($input['b2c_payment_id']);
        $sql = "SELECT bp.*, bc.result_code, bc.result_description, bc.transaction_id
                FROM b2c_payments bp
                LEFT JOIN b2c_payment_callbacks bc ON bp.reference_id = bc.reference_id
                WHERE bp.id = '$b2cPaymentId' LIMIT 1";

        $result = $conn->query($sql);

        if (!$result || $result->num_rows === 0) {
            respond("error", "B2C payment not found.", null, 404);
        }

        $payment = $result->fetch_assoc();
        respond("success", "B2C payment status fetched.", ["data" => $payment]);
        break;

    // GET B2C PAYMENTS (for admin or trainer)
    case 'b2c_payments_get':
        $trainerId = isset($input['trainer_id']) ? $conn->real_escape_string($input['trainer_id']) : null;
        $status = isset($input['status']) ? $conn->real_escape_string($input['status']) : null;

        $where = "1=1";
        if ($trainerId) {
            $where .= " AND bp.user_id = '$trainerId'";
        }
        if ($status) {
            $where .= " AND bp.status = '$status'";
        }

        $sql = "SELECT bp.*, bc.result_code, bc.result_description, bc.transaction_id
                FROM b2c_payments bp
                LEFT JOIN b2c_payment_callbacks bc ON bp.reference_id = bc.reference_id
                WHERE $where
                ORDER BY bp.initiated_at DESC LIMIT 100";

        $result = $conn->query($sql);

        if (!$result) {
            respond("error", "Query failed: " . $conn->error, null, 500);
        }

        $payments = [];
        while ($row = $result->fetch_assoc()) {
            $payments[] = $row;
        }

        respond("success", "B2C payments fetched.", ["data" => $payments]);
        break;

    // ============================================================================
    // STK PUSH PAYMENT ENDPOINTS
    // ============================================================================

    // INITIATE STK PUSH PAYMENT
    case 'stk_push_initiate':
        if (!isset($input['phone']) || !isset($input['amount'])) {
            respond("error", "Missing required fields: phone, amount.", null, 400);
        }

        // Validate M-Pesa credentials are configured
        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            respond("error", $credValidation['error'], null, 500);
        }

        $phone = $conn->real_escape_string($input['phone']);
        $amount = floatval($input['amount']);
        $bookingId = isset($input['booking_id']) ? $conn->real_escape_string($input['booking_id']) : null;
        $accountReference = isset($input['account_reference']) ? $conn->real_escape_string($input['account_reference']) : 'payment_' . uniqid();
        $description = isset($input['transaction_description']) ? $conn->real_escape_string($input['transaction_description']) : 'Service Payment';

        // Normalize phone number
        $phone = str_replace(['+', ' ', '-'], '', $phone);
        if (substr($phone, 0, 1) !== '2') {
            $phone = '254' . substr($phone, -9);
        }

        if (strlen($phone) !== 12 || !is_numeric($phone)) {
            respond("error", "Invalid phone number format.", null, 400);
        }

        if ($amount < 5 || $amount > 150000) {
            respond("error", "Amount must be between 5 and 150000.", null, 400);
        }

        // Get server-side credentials (NOT from request body)
        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            respond("error", "M-Pesa credentials not properly configured.", null, 500);
        }

        // Determine callback URL (uses default from mpesa_helper if not in credentials)
        $callbackUrl = null;
        if (!empty($mpesaCreds['result_url'])) {
            $callbackUrl = $mpesaCreds['result_url'];
        }

        // Call M-Pesa API to initiate STK Push
        $stkResult = initiateSTKPush($mpesaCreds, $phone, $amount, $accountReference, $callbackUrl);

        if (!$stkResult['success']) {
            logPaymentEvent('stk_push_failed', [
                'phone' => $phone,
                'amount' => $amount,
                'error' => $stkResult['error']
            ]);
            respond("error", $stkResult['error'], null, 500);
        }

        // Create STK push session record
        $sessionId = 'stk_' . uniqid();
        $now = date('Y-m-d H:i:s');
        $checkoutRequestId = $stkResult['checkout_request_id'];
        $initStatus = 'initiated';

        $createTableSql = "
            CREATE TABLE IF NOT EXISTS `stk_push_sessions` (
                `id` VARCHAR(36) PRIMARY KEY,
                `phone_number` VARCHAR(20) NOT NULL,
                `amount` DECIMAL(15, 2) NOT NULL,
                `booking_id` VARCHAR(36),
                `account_reference` VARCHAR(255) NOT NULL,
                `description` TEXT,
                `checkout_request_id` VARCHAR(255) UNIQUE,
                `merchant_request_id` VARCHAR(255),
                `status` VARCHAR(50) DEFAULT 'initiated',
                `result_code` VARCHAR(10),
                `result_description` TEXT,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX `idx_phone` (`phone_number`),
                INDEX `idx_status` (`status`),
                INDEX `idx_checkout` (`checkout_request_id`),
                INDEX `idx_booking_id` (`booking_id`),
                INDEX `idx_created_at` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ";
        $conn->query($createTableSql);

        $stmt = $conn->prepare("
            INSERT INTO stk_push_sessions (
                id, phone_number, amount, booking_id, account_reference, description, checkout_request_id, merchant_request_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        if (!$stmt) {
            respond("error", "Failed to create session record: " . $conn->error, null, 500);
        }

        $merchantRequestId = $stkResult['merchant_request_id'] ?? '';
        $stmt->bind_param("ssdssssssss", $sessionId, $phone, $amount, $bookingId, $accountReference, $description, $checkoutRequestId, $merchantRequestId, $initStatus, $now, $now);

        if (!$stmt->execute()) {
            $stmt->close();
            respond("error", "Failed to save session: " . $conn->error, null, 500);
        }
        $stmt->close();

        logPaymentEvent('stk_push_initiated', [
            'session_id' => $sessionId,
            'phone' => $phone,
            'amount' => $amount,
            'checkout_request_id' => $checkoutRequestId,
            'credentials_source' => $mpesaCreds['source']
        ]);

        respond("success", "STK push initiated successfully.", [
            "session_id" => $sessionId,
            "CheckoutRequestID" => $checkoutRequestId,
            "phone" => $phone,
            "amount" => $amount
        ]);
        break;

    // QUERY STK PUSH STATUS
    case 'stk_push_query':
        if (!isset($input['checkout_request_id'])) {
            respond("error", "Missing checkout_request_id.", null, 400);
        }

        // Validate M-Pesa credentials are configured
        $credValidation = validateMpesaCredentialsConfigured();
        if (!$credValidation['valid']) {
            respond("error", $credValidation['error'], null, 500);
        }

        $checkoutRequestId = $conn->real_escape_string($input['checkout_request_id']);

        // Query the session
        $sql = "SELECT * FROM stk_push_sessions WHERE checkout_request_id = ? LIMIT 1";
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            respond("error", "Table does not exist yet. Initialize payments first.", null, 500);
        }

        $stmt->bind_param("s", $checkoutRequestId);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result->num_rows === 0) {
            respond("error", "Session not found.", null, 404);
        }

        $session = $result->fetch_assoc();

        // Query M-Pesa for actual status
        $mpesaCreds = getMpesaCredentials();
        if (!$mpesaCreds) {
            respond("error", "M-Pesa credentials not configured.", null, 500);
        }

        $queryResult = querySTKPushStatus($mpesaCreds, $checkoutRequestId);

        if (!$queryResult['success']) {
            // If M-Pesa query fails, return cached status from DB
            logPaymentEvent('stk_push_query_failed', [
                'checkout_request_id' => $checkoutRequestId,
                'error' => $queryResult['error']
            ]);

            respond("success", "STK push status retrieved (cached).", [
                "session_id" => $session['id'],
                "status" => $session['status'],
                "result_code" => $session['result_code'],
                "result_description" => $session['result_description'],
                "amount" => $session['amount'],
                "phone" => $session['phone_number'],
                "cached" => true
            ]);
        }

        respond("success", "STK push status retrieved.", [
            "session_id" => $session['id'],
            "status" => $queryResult['result_code'] === '0' ? 'success' : 'pending',
            "result_code" => $queryResult['result_code'],
            "result_description" => $queryResult['result_description'],
            "amount" => $session['amount'],
            "phone" => $session['phone_number']
        ]);
        break;

    // COMPLETE STK PUSH PAYMENT (callback from M-Pesa)
    case 'stk_push_callback':
        if (!isset($input['checkout_request_id'])) {
            respond("error", "Missing checkout_request_id.", null, 400);
        }

        $checkoutRequestId = $conn->real_escape_string($input['checkout_request_id']);
        $resultCode = isset($input['result_code']) ? $conn->real_escape_string($input['result_code']) : null;
        $resultDescription = isset($input['result_description']) ? $conn->real_escape_string($input['result_description']) : null;
        $merchantRequestId = isset($input['merchant_request_id']) ? $conn->real_escape_string($input['merchant_request_id']) : null;

        // Determine status based on result code
        $status = 'failed';
        if ($resultCode === '0' || $resultCode === 0) {
            $status = 'success';
        } elseif ($resultCode === '1032' || $resultCode === 1032) {
            $status = 'timeout';
        }

        // Update the session
        $stmt = $conn->prepare("
            UPDATE stk_push_sessions
            SET status = ?, result_code = ?, result_description = ?, updated_at = NOW()
            WHERE checkout_request_id = ?
        ");

        $stmt->bind_param("ssss", $status, $resultCode, $resultDescription, $checkoutRequestId);

        if ($stmt->execute()) {
            $stmt->close();

            logEvent('stk_push_completed', [
                'checkout_request_id' => $checkoutRequestId,
                'status' => $status,
                'result_code' => $resultCode
            ]);

            respond("success", "STK push status updated.", [
                "status" => $status,
                "checkout_request_id" => $checkoutRequestId
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to update STK push: " . $conn->error, null, 500);
        }
        break;

    // GET STK PUSH HISTORY
    case 'stk_push_history':
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;

        if ($limit > 100) $limit = 100;
        if ($offset < 0) $offset = 0;

        $sql = "SELECT * FROM stk_push_sessions ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);

        if (!$stmt) {
            respond("error", "Table does not exist yet.", null, 500);
        }

        $stmt->bind_param("ii", $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $sessions = [];
        while ($row = $result->fetch_assoc()) {
            $sessions[] = $row;
        }

        respond("success", "STK push history retrieved.", ["data" => $sessions]);
        break;

    // ============================================================================
    // WALLET MANAGEMENT ENDPOINTS
    // ============================================================================

    // GET WALLET BALANCE
    case 'wallet_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);

        // Ensure wallet table exists
        $conn->query("
            CREATE TABLE IF NOT EXISTS `user_wallets` (
                `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
                `user_id` VARCHAR(36) NOT NULL UNIQUE,
                `balance` DECIMAL(15, 2) DEFAULT 0,
                `available_balance` DECIMAL(15, 2) DEFAULT 0,
                `pending_balance` DECIMAL(15, 2) DEFAULT 0,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT `fk_wallet_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Get or create wallet
        $sql = "SELECT * FROM user_wallets WHERE user_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result->num_rows === 0) {
            // Create new wallet
            $walletId = uniqid();
            $now = date('Y-m-d H:i:s');
            $stmt = $conn->prepare("
                INSERT INTO user_wallets (id, user_id, balance, available_balance, pending_balance, created_at, updated_at)
                VALUES (?, ?, 0, 0, 0, ?, ?)
            ");
            $stmt->bind_param("ssss", $walletId, $userId, $now, $now);
            $stmt->execute();
            $stmt->close();

            $wallet = [
                'id' => $walletId,
                'user_id' => $userId,
                'balance' => 0,
                'available_balance' => 0,
                'pending_balance' => 0,
                'created_at' => $now,
                'updated_at' => $now
            ];
        } else {
            $wallet = $result->fetch_assoc();
        }

        respond("success", "Wallet fetched successfully.", ["data" => $wallet]);
        break;

    // UPDATE WALLET BALANCE
    case 'wallet_update':
        if (!isset($input['user_id']) || !isset($input['amount']) || !isset($input['transaction_type'])) {
            respond("error", "Missing user_id, amount, or transaction_type.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $amount = floatval($input['amount']);
        $transactionType = $conn->real_escape_string($input['transaction_type']); // 'deposit', 'withdrawal', 'commission'
        $reference = isset($input['reference']) ? $conn->real_escape_string($input['reference']) : null;
        $description = isset($input['description']) ? $conn->real_escape_string($input['description']) : null;

        // Get current wallet
        $walletQuery = $conn->query("SELECT * FROM user_wallets WHERE user_id = '$userId'");
        if ($walletQuery->num_rows === 0) {
            respond("error", "Wallet not found. Create wallet first.", null, 404);
        }

        $wallet = $walletQuery->fetch_assoc();
        $currentBalance = floatval($wallet['balance']);
        $newBalance = $currentBalance + $amount;

        if ($newBalance < 0 && $transactionType === 'withdrawal') {
            respond("error", "Insufficient balance.", null, 400);
        }

        // Update wallet
        $stmt = $conn->prepare("
            UPDATE user_wallets
            SET balance = ?, available_balance = ?, updated_at = NOW()
            WHERE user_id = ?
        ");

        $stmt->bind_param("dss", $newBalance, $newBalance, $userId);

        if ($stmt->execute()) {
            $stmt->close();

            // Create transaction record
            $transactionId = 'txn_' . uniqid();
            $now = date('Y-m-d H:i:s');

            $txnStmt = $conn->prepare("
                INSERT INTO wallet_transactions (id, user_id, type, amount, reference, description, balance_after, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $txnStmt->bind_param("sssdssss", $transactionId, $userId, $transactionType, $amount, $reference, $description, $newBalance, $now);
            $txnStmt->execute();
            $txnStmt->close();

            logEvent('wallet_updated', [
                'user_id' => $userId,
                'transaction_type' => $transactionType,
                'amount' => $amount,
                'new_balance' => $newBalance
            ]);

            respond("success", "Wallet updated successfully.", [
                "user_id" => $userId,
                "old_balance" => $currentBalance,
                "amount" => $amount,
                "new_balance" => $newBalance,
                "transaction_id" => $transactionId
            ]);
        } else {
            $stmt->close();
            respond("error", "Failed to update wallet: " . $conn->error, null, 500);
        }
        break;

    // GET WALLET TRANSACTIONS
    case 'wallet_transactions_get':
        if (!isset($input['user_id'])) {
            respond("error", "Missing user_id.", null, 400);
        }

        $userId = $conn->real_escape_string($input['user_id']);
        $limit = isset($input['limit']) ? intval($input['limit']) : 50;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;

        if ($limit > 100) $limit = 100;

        // Ensure table exists
        $conn->query("
            CREATE TABLE IF NOT EXISTS `wallet_transactions` (
                `id` VARCHAR(36) PRIMARY KEY,
                `user_id` VARCHAR(36) NOT NULL,
                `type` VARCHAR(50) NOT NULL,
                `amount` DECIMAL(15, 2) NOT NULL,
                `reference` VARCHAR(255),
                `description` TEXT,
                `balance_after` DECIMAL(15, 2),
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT `fk_wallet_txn_user_id`
                    FOREIGN KEY (`user_id`)
                    REFERENCES `users`(`id`)
                    ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_created_at` (`created_at` DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $sql = "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("sii", $userId, $limit, $offset);
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        $transactions = [];
        while ($row = $result->fetch_assoc()) {
            $transactions[] = $row;
        }

        respond("success", "Wallet transactions retrieved.", ["data" => $transactions]);
        break;

    // UNKNOWN ACTION
    default:
        respond("error", "Invalid action '$action'.", null, 400);
}
?>
