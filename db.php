<?php
// Database connection. Change these to match your MySQL setup.
const DB_HOST = '127.0.0.1';
const DB_PORT = 3307;        // change this if your MySQL runs on another port (check XAMPP/Laragon)
const DB_NAME = 'library_system';
const DB_USER = 'root';
const DB_PASS = '';          // XAMPP/Laragon default is an empty password

$pdo = new PDO(
    'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
    DB_USER,
    DB_PASS,
    [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,   // real prepared statements
    ]
);