<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
unset($_SESSION['google_token']);
unset($_SESSION['email']);
header('Location: ' . base_url());
exit;

