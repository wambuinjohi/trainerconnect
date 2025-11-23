<?php
/**
 * Migration: Create contacts table
 * Usage: php scripts/migrate_contacts_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `contacts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `user_type` ENUM('client', 'trainer') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_phone (phone),
  INDEX idx_user_type (user_type),
  INDEX idx_created_at (created_at),
  UNIQUE KEY unique_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: contacts table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
