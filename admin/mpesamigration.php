<?php
/**
 * M-Pesa Tables Migration Endpoint
 * 
 * Creates all necessary M-Pesa and payment system tables
 * 
 * Route: GET/POST /admin/mpesamigration
 * Response: JSON with success status and details
 * 
 * No authentication required
 */

// Disable output buffering
if (ob_get_level()) {
    ob_end_clean();
}
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set JSON response headers
if (!headers_sent()) {
    header("Content-Type: application/json; charset=utf-8");
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
}

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Include database connection
require_once(__DIR__ . '/../connection.php');

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
        'tables_created' => 0,
        'tables_failed' => 0
    ]);
    exit;
}

// All M-Pesa and payment tables to create
$tables = [
    'stk_push_sessions' => "
        CREATE TABLE IF NOT EXISTS `stk_push_sessions` (
            `id` VARCHAR(36) PRIMARY KEY,
            `phone_number` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `booking_id` VARCHAR(36),
            `account_reference` VARCHAR(255) NOT NULL,
            `description` TEXT,
            `checkout_request_id` VARCHAR(255) UNIQUE,
            `status` VARCHAR(50) DEFAULT 'initiated' COMMENT 'initiated, pending, success, failed, timeout',
            `result_code` VARCHAR(10),
            `result_description` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX `idx_phone` (`phone_number`),
            INDEX `idx_status` (`status`),
            INDEX `idx_booking_id` (`booking_id`),
            INDEX `idx_checkout_request_id` (`checkout_request_id`),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'user_wallets' => "
        CREATE TABLE IF NOT EXISTS `user_wallets` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL UNIQUE,
            `balance` DECIMAL(15, 2) DEFAULT 0,
            `available_balance` DECIMAL(15, 2) DEFAULT 0,
            `pending_balance` DECIMAL(15, 2) DEFAULT 0,
            `total_earned` DECIMAL(15, 2) DEFAULT 0,
            `total_withdrawn` DECIMAL(15, 2) DEFAULT 0,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_wallet_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_updated_at` (`updated_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'wallet_transactions' => "
        CREATE TABLE IF NOT EXISTS `wallet_transactions` (
            `id` VARCHAR(36) PRIMARY KEY,
            `user_id` VARCHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL COMMENT 'deposit, withdrawal, commission, refund, payment',
            `amount` DECIMAL(15, 2) NOT NULL,
            `reference` VARCHAR(255),
            `description` TEXT,
            `balance_before` DECIMAL(15, 2),
            `balance_after` DECIMAL(15, 2),
            `status` VARCHAR(50) DEFAULT 'completed' COMMENT 'pending, completed, failed',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT `fk_wallet_txn_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_type` (`type`),
            INDEX `idx_created_at` (`created_at` DESC),
            INDEX `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'payments' => "
        CREATE TABLE IF NOT EXISTS `payments` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36),
            `client_id` VARCHAR(36),
            `trainer_id` VARCHAR(36),
            `booking_id` VARCHAR(36),
            `amount` DECIMAL(15, 2) NOT NULL,
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, completed, failed, refunded',
            `method` VARCHAR(50) NOT NULL COMMENT 'mpesa, stk, card, bank, wallet, b2c',
            `transaction_reference` VARCHAR(255),
            `description` TEXT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payments_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE SET NULL,
            CONSTRAINT `fk_payments_booking_id`
                FOREIGN KEY (`booking_id`)
                REFERENCES `bookings`(`id`)
                ON DELETE SET NULL,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_client_id` (`client_id`),
            INDEX `idx_trainer_id` (`trainer_id`),
            INDEX `idx_booking_id` (`booking_id`),
            INDEX `idx_status` (`status`),
            INDEX `idx_method` (`method`),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'b2c_payments' => "
        CREATE TABLE IF NOT EXISTS `b2c_payments` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL,
            `user_type` VARCHAR(20) NOT NULL COMMENT 'trainer, client',
            `phone_number` VARCHAR(20) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `reference_id` VARCHAR(255) UNIQUE NOT NULL COMMENT 'Unique reference for callback matching',
            `transaction_id` VARCHAR(255) UNIQUE COMMENT 'M-Pesa transaction ID',
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, initiated, completed, failed',
            `error_description` TEXT COMMENT 'Error message if failed',
            `reason_code` VARCHAR(100) COMMENT 'M-Pesa result code',
            `initiated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `completed_at` TIMESTAMP NULL,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_b2c_payments_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_reference_id` (`reference_id`),
            INDEX `idx_transaction_id` (`transaction_id`),
            INDEX `idx_status` (`status`),
            INDEX `idx_initiated_at` (`initiated_at` DESC),
            INDEX `idx_phone` (`phone_number`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'b2c_payment_callbacks' => "
        CREATE TABLE IF NOT EXISTS `b2c_payment_callbacks` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `transaction_id` VARCHAR(255) UNIQUE NOT NULL,
            `originator_conversation_id` VARCHAR(255),
            `conversation_id` VARCHAR(255),
            `result_code` INT COMMENT 'M-Pesa result code (0 = success)',
            `result_description` TEXT COMMENT 'M-Pesa result description',
            `transaction_amount` DECIMAL(15, 2),
            `receiver_phone` VARCHAR(20),
            `reference_id` VARCHAR(255) COMMENT 'Links back to b2c_payments.reference_id',
            `raw_response` LONGTEXT COMMENT 'Full JSON response from M-Pesa',
            `received_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT `fk_b2c_callbacks_reference_id`
                FOREIGN KEY (`reference_id`)
                REFERENCES `b2c_payments`(`reference_id`)
                ON DELETE CASCADE,
            INDEX `idx_transaction_id` (`transaction_id`),
            INDEX `idx_reference_id` (`reference_id`),
            INDEX `idx_result_code` (`result_code`),
            INDEX `idx_received_at` (`received_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'payout_requests' => "
        CREATE TABLE IF NOT EXISTS `payout_requests` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `trainer_id` VARCHAR(36) NOT NULL,
            `amount` DECIMAL(15, 2) NOT NULL,
            `commission` DECIMAL(15, 2),
            `net_amount` DECIMAL(15, 2),
            `b2c_payment_id` VARCHAR(36),
            `status` VARCHAR(50) DEFAULT 'pending' COMMENT 'pending, approved, completed, rejected, cancelled',
            `rejection_reason` TEXT,
            `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `approved_at` TIMESTAMP NULL,
            `completed_at` TIMESTAMP NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payout_requests_trainer_id`
                FOREIGN KEY (`trainer_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            CONSTRAINT `fk_payout_requests_b2c_payment_id`
                FOREIGN KEY (`b2c_payment_id`)
                REFERENCES `b2c_payments`(`id`)
                ON DELETE SET NULL,
            INDEX `idx_trainer_id` (`trainer_id`),
            INDEX `idx_status` (`status`),
            INDEX `idx_requested_at` (`requested_at` DESC),
            INDEX `idx_created_at` (`created_at` DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ",
    
    'payment_methods' => "
        CREATE TABLE IF NOT EXISTS `payment_methods` (
            `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
            `user_id` VARCHAR(36) NOT NULL,
            `type` VARCHAR(50) NOT NULL COMMENT 'mpesa, card, bank',
            `phone_number` VARCHAR(20),
            `card_last_four` VARCHAR(4),
            `bank_account` VARCHAR(50),
            `is_default` BOOLEAN DEFAULT FALSE,
            `is_active` BOOLEAN DEFAULT TRUE,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT `fk_payment_methods_user_id`
                FOREIGN KEY (`user_id`)
                REFERENCES `users`(`id`)
                ON DELETE CASCADE,
            INDEX `idx_user_id` (`user_id`),
            INDEX `idx_is_default` (`is_default`),
            INDEX `idx_is_active` (`is_active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    "
];

// Execute migrations
$createdTables = [];
$failedTables = [];

foreach ($tables as $tableName => $sql) {
    if ($conn->query($sql)) {
        $createdTables[] = $tableName;
    } else {
        // Check if table already exists
        if (strpos($conn->error, "already exists") !== false || 
            strpos($conn->error, "Duplicate") !== false) {
            $createdTables[] = $tableName . ' (already exists)';
        } else {
            $failedTables[] = [
                'table' => $tableName,
                'error' => $conn->error
            ];
        }
    }
}

// Prepare response
$success = empty($failedTables);
$statusCode = $success ? 200 : 206; // 206 = Partial Content if some failed

http_response_code($statusCode);
echo json_encode([
    'status' => $success ? 'success' : 'partial_success',
    'message' => $success 
        ? 'All M-Pesa tables migrated successfully' 
        : 'Some tables failed to migrate',
    'tables_created' => count($createdTables),
    'tables_failed' => count($failedTables),
    'created_tables' => $createdTables,
    'failed_tables' => $failedTables,
    'timestamp' => date('Y-m-d H:i:s')
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

exit;
?>
