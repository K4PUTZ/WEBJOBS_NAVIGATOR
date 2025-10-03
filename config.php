<?php
declare(strict_types=1);

// Start session for token storage
if (session_status() !== PHP_SESSION_ACTIVE) {
  // Set a custom session save path if the default doesn't work
  $session_path = sys_get_temp_dir();
  if (is_writable($session_path)) {
    session_save_path($session_path);
  }
  session_start();
}

// Composer autoload (optional during first deploy)
@include __DIR__ . '/vendor/autoload.php';

// Where your OAuth client JSON will live (upload this file manually)
define('CREDENTIALS_FILE', __DIR__ . '/credentials.json');
// OAuth scopes
define('SCOPES', [
  'https://www.googleapis.com/auth/drive',
  'openid', 'email', 'profile'
]);

// Build absolute URL helper
function base_url(): string {
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $path = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/jobs_navigator/'), '/');
  // Ensure trailing slash for base
  return $scheme . '://' . $host . ($path ? $path . '/' : '/');
}

function make_client(): ?Google_Client {
  if (!class_exists('Google_Client')) return null; // library not installed yet
  $client = new Google_Client();
  if (is_file(CREDENTIALS_FILE)) {
    $client->setAuthConfig(CREDENTIALS_FILE);
  }
  $client->setScopes(SCOPES);
  $client->setAccessType('offline');
  $client->setPrompt('consent');
  $client->setIncludeGrantedScopes(true);
  $client->setRedirectUri(base_url() . 'callback.php');
  return $client;
}

function save_token(array $token): void {
  $_SESSION['google_token'] = $token;
}

function load_token(): ?array {
  $t = $_SESSION['google_token'] ?? null;
  return (is_array($t)) ? $t : null;
}

function set_account_email(?string $email): void {
  if ($email) $_SESSION['email'] = $email; else unset($_SESSION['email']);
}

function get_account_email(): ?string {
  $v = $_SESSION['email'] ?? null;
  return $v ? strval($v) : null;
}

function is_connected(): bool {
  return load_token() !== null && get_account_email() !== null;
}

