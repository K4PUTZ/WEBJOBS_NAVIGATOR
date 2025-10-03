<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$client = make_client();
if ($client === null) {
  http_response_code(500);
  echo 'Google API client is not installed. Run composer install.';
  exit;
}

// Reset state to force refresh if already connected
if (isset($_GET['refresh'])) {
  unset($_SESSION['google_token']);
  unset($_SESSION['email']);
}

$authUrl = $client->createAuthUrl();
header('Location: ' . $authUrl);
exit;

