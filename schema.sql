-- Library System database
-- Import in phpMyAdmin (Import tab) or run:  mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS library_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE library_system;

DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS borrowers;
DROP TABLE IF EXISTS books;

CREATE TABLE books (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title  VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  copies TINYINT UNSIGNED NOT NULL DEFAULT 1,
  CONSTRAINT chk_copies CHECK (copies BETWEEN 1 AND 99)
);

CREATE TABLE borrowers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  student_id VARCHAR(20)  NOT NULL UNIQUE,            -- digits only, kept as text so leading zeros survive
  course     ENUM('BSIT','BSAIS','BS-PSYCH','BSBA','EDUC') NOT NULL,
  CONSTRAINT chk_student_id CHECK (student_id REGEXP '^[0-9]+$')
);

-- Deleting a book or borrower keeps the loan history (the id becomes NULL).
CREATE TABLE loans (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  borrower_id INT UNSIGNED NULL,
  book_id     INT UNSIGNED NULL,
  borrowed    DATE NOT NULL,
  due         DATE NOT NULL,
  returned    DATE NULL,                              -- NULL = still borrowed
  CONSTRAINT fk_loan_borrower FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE SET NULL,
  CONSTRAINT fk_loan_book     FOREIGN KEY (book_id)     REFERENCES books(id)     ON DELETE SET NULL,
  CONSTRAINT chk_dates CHECK (due >= borrowed),
  INDEX idx_active (book_id, returned)
);

-- Sample data
INSERT INTO books (id, title, author, copies) VALUES
  (1,'The Hobbit','J.R.R. Tolkien',3), (2,'1984','George Orwell',2),
  (3,'To Kill a Mockingbird','Harper Lee',2), (4,'The Great Gatsby','F. Scott Fitzgerald',2),
  (5,'Dune','Frank Herbert',2), (6,'Pride and Prejudice','Jane Austen',1);

INSERT INTO borrowers (id, name, student_id, course) VALUES
  (1,'Juan Dela Cruz','20230101','BSIT'), (2,'Maria Santos','20230102','EDUC'),
  (3,'Jose Reyes','20220417','BSBA'),     (4,'Ana Cruz','20240233','BS-PSYCH'),
  (5,'Luis Garcia','20240310','BSAIS');

INSERT INTO loans (borrower_id, book_id, borrowed, due, returned) VALUES
  (1,1, CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 6 DAY,  CURDATE() - INTERVAL 10 DAY),
  (2,2, CURDATE() - INTERVAL 33 DAY, CURDATE() - INTERVAL 19 DAY, NULL),
  (3,3, CURDATE() - INTERVAL 25 DAY, CURDATE() - INTERVAL 11 DAY, NULL),
  (4,4, CURDATE() - INTERVAL 18 DAY, CURDATE() - INTERVAL 4 DAY,  CURDATE() - INTERVAL 2 DAY),
  (5,5, CURDATE() - INTERVAL 2 DAY,  CURDATE() + INTERVAL 12 DAY, NULL);
