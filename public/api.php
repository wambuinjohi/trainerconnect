<?php
// This file has been consolidated into /api.php at the root
// Please use https://trainer.skatryk.co.ke/api.php instead
header("Content-Type: application/json");
die(json_encode([
    "status" => "error",
    "message" => "This API has been moved. Please use https://trainer.skatryk.co.ke/api.php"
]));
?>
