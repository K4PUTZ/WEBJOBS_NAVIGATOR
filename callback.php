<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

// Google API namespace imports
use Google\Service\Oauth2 as Google_Service_Oauth2;

$client = make_client();
if ($client === null) {
  http_response_code(500);
  echo 'Google API client is not installed. Run composer install.';
  exit;
}

if (!isset($_GET['code'])) {
  http_response_code(400);
  echo 'Missing authorization code';
  exit;
}

$token = $client->fetchAccessTokenWithAuthCode($_GET['code']);
if (isset($token['error'])) {
  http_response_code(400);
  echo 'Auth error: ' . htmlspecialchars(strval($token['error']));
  exit;
}
$client->setAccessToken($token);
save_token($client->getAccessToken());
// Regenerate session ID after login to prevent fixation
if (function_exists('session_regenerate_id')) {
  @session_regenerate_id(true);
}

// Fetch profile email for status bar
try {
  if (class_exists('Google_Service_Oauth2')) {
    $oauth2 = new Google_Service_Oauth2($client);
    $info = $oauth2->userinfo->get();
    set_account_email($info->email ?? null);
  }
} catch (Throwable $e) {
  // Ignore - will work once composer install is run
}

// Redirect back to app root
header('Location: ' . base_url());
exit;
