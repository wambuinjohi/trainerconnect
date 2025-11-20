<?php
/**
 * Migration: Create referrals table
 * Usage: php scripts/migrate_referrals_table.php
 */

require_once(__DIR__ . '/../connection.php');

$sql = "
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `referrer_id` VARCHAR(36) NOT NULL,
  `referee_id` VARCHAR(36),
  `discount_used` BOOLEAN DEFAULT FALSE,
  `discount_amount` DECIMAL(15, 2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_referrals_referrer_id`
    FOREIGN KEY (`referrer_id`)
    REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_referrals_referee_id`
    FOREIGN KEY (`referee_id`)
    REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  INDEX `idx_referrer_id` (`referrer_id`),
  INDEX `idx_referee_id` (`referee_id`),
  INDEX `idx_code` (`code`),
  INDEX `idx_discount_used` (`discount_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
";

if ($conn->query($sql)) {
    echo "✓ Migration successful: referrals table created or already exists\n";
    exit(0);
} else {
    echo "✗ Migration failed: " . $conn->error . "\n";
    exit(1);
}
?>
