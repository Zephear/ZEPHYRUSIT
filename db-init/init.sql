CREATE DATABASE IF NOT EXISTS zephyrus_db;
USE zephyrus_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    type VARCHAR(20) NOT NULL DEFAULT 'All Notes',
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_completed BOOLEAN DEFAULT FALSE,
    assignee VARCHAR(50) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT IGNORE INTO users (username, password_hash, role) 
VALUES ('vladyslav', '$2b$12$rP5TjgdKK1GBr60ug.1o8enwTWpIgOtUteR5vozsvqspbW3D7CZB.', 'admin');

INSERT IGNORE INTO users (username, password_hash, role) 
VALUES ('user1', '$2b$12$rP5TjgdKK1GBr60ug.1o8enwTWpIgOtUteR5vozsvqspbW3D7CZB.', 'user');

INSERT IGNORE INTO news (title, content) VALUES 
('Welcome to ZephyrusIT', 'Please join us in welcoming our new team members.'),
('Scheduled System Maintenance', 'Main server cluster will undergo scheduled maintenance this Saturday.');