<?php
// JSON API used by script.js:  api.php?action=...
header('Content-Type: application/json; charset=utf-8');

const COURSES = ['BSIT', 'BSAIS', 'BS-PSYCH', 'BSBA', 'EDUC'];
const PENALTY_PER_WEEK = 5;   // pesos for every week (started) after the due date
const LOAN_DAYS = 14;

function out(array $data, int $code = 200): never { http_response_code($code); echo json_encode($data); exit; }
function fail(string $msg, int $code = 422): never { out(['error' => $msg], $code); }

try {
    require __DIR__ . '/db.php';
} catch (Throwable $e) {
    fail('Cannot connect to the database. Check db.php and that MySQL is running.', 500);
}

$action = $_GET['action'] ?? '';
$in     = json_decode(file_get_contents('php://input'), true) ?? [];
$str    = fn(string $k): string => trim((string)($in[$k] ?? ''));

// work even when the mbstring extension is not enabled
function len(string $s): int   { return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s); }
function lower(string $s): string { return function_exists('mb_strtolower') ? mb_strtolower($s) : strtolower($s); }
function validDate(string $d): bool {
    return preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
}
function available(PDO $pdo, int $bookId): int {
    $q = $pdo->prepare('SELECT b.copies - COUNT(l.id) FROM books b
                        LEFT JOIN loans l ON l.book_id = b.id AND l.returned IS NULL
                        WHERE b.id = ? GROUP BY b.id');
    $q->execute([$bookId]);
    return (int)$q->fetchColumn();
}
function hasActiveLoan(PDO $pdo, string $col, int $id): bool {
    $q = $pdo->prepare("SELECT 1 FROM loans WHERE $col = ? AND returned IS NULL LIMIT 1");   // $col is fixed below, never user input
    $q->execute([$id]);
    return (bool)$q->fetchColumn();
}

try {
    if ($action === 'all') {
        $books = $pdo->query('SELECT CAST(id AS CHAR) AS id, title, author, copies FROM books ORDER BY id')->fetchAll();
        $people = $pdo->query('SELECT CAST(id AS CHAR) AS id, name, student_id AS sid, course FROM borrowers ORDER BY id')->fetchAll();
        // days late stop counting once the book is returned; fee = started weeks x rate
        $loans = $pdo->query(
            'SELECT CAST(id AS CHAR) AS id, CAST(borrower_id AS CHAR) AS pid, CAST(book_id AS CHAR) AS bid,
                    borrowed, due, returned,
                    GREATEST(0, DATEDIFF(COALESCE(returned, CURDATE()), due)) AS days,
                    CEIL(GREATEST(0, DATEDIFF(COALESCE(returned, CURDATE()), due)) / 7) * ' . PENALTY_PER_WEEK . ' AS fee
             FROM loans ORDER BY id'
        )->fetchAll();
        foreach ($books as &$b) { $b['copies'] = (int)$b['copies']; }
        foreach ($loans as &$l) { $l['returned'] = $l['returned'] ?? ''; $l['days'] = (int)$l['days']; $l['fee'] = (int)$l['fee']; }
        out(['books' => $books, 'people' => $people, 'loans' => $loans]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Use POST for this action.', 405);

    switch ($action) {
        case 'add_borrower':   // Add Borrower form: finds or creates the borrower and book, then records the loan
            $name = $str('name'); $sid = $str('sid'); $course = $str('course'); $title = $str('title'); $author = $str('author');
            if ($name === '' || $sid === '' || $title === '' || $author === '') fail('Fill in the name, ID number, book title and author.');
            if (!preg_match('/^\d{1,20}$/', $sid)) fail('The ID number can only contain numbers.');
            if (!in_array($course, COURSES, true)) fail('Choose a course or program from the list.');
            if (len($name) > 100 || len($title) > 200 || len($author) > 150) fail('One of the fields is too long.');

            $pdo->beginTransaction();
            $q = $pdo->prepare('SELECT id, name FROM borrowers WHERE student_id = ? FOR UPDATE');
            $q->execute([$sid]);
            $p = $q->fetch();
            if ($p && lower($p['name']) !== lower($name)) fail('That ID number belongs to ' . $p['name'] . '.');

            $q = $pdo->prepare('SELECT id FROM books WHERE title = ? AND author = ? FOR UPDATE');
            $q->execute([$title, $author]);
            $bookId = $q->fetchColumn();
            if ($bookId && available($pdo, (int)$bookId) < 1) fail('All copies of that book are already lent out.');

            if (!$p) {
                $pdo->prepare('INSERT INTO borrowers (name, student_id, course) VALUES (?,?,?)')->execute([$name, $sid, $course]);
                $personId = (int)$pdo->lastInsertId();
            } else { $personId = (int)$p['id']; }
            if (!$bookId) {
                $pdo->prepare('INSERT INTO books (title, author, copies) VALUES (?,?,1)')->execute([$title, $author]);
                $bookId = (int)$pdo->lastInsertId();
            }
            $pdo->prepare('INSERT INTO loans (borrower_id, book_id, borrowed, due) VALUES (?,?,CURDATE(),CURDATE() + INTERVAL ' . LOAN_DAYS . ' DAY)')
                ->execute([$personId, $bookId]);
            $pdo->commit();
            out(['ok' => true]);

        case 'add_book':
            $title = $str('title'); $author = $str('author'); $copies = (int)($in['copies'] ?? 1);
            if ($title === '' || $author === '') fail('Enter a title and an author.');
            if (len($title) > 200 || len($author) > 150) fail('The title or author is too long.');
            $copies = max(1, min(99, $copies));
            $pdo->prepare('INSERT INTO books (title, author, copies) VALUES (?,?,?)')->execute([$title, $author, $copies]);
            out(['ok' => true]);

        case 'add_loan':       // New Loan dialog
            $pid = (int)($in['pid'] ?? 0); $bid = (int)($in['bid'] ?? 0);
            $borrowed = $str('borrowed'); $due = $str('due');
            if (!validDate($borrowed) || !validDate($due)) fail('Enter valid dates.');
            if ($due < $borrowed) fail('The due date cannot be before the borrow date.');
            $pdo->beginTransaction();
            $q = $pdo->prepare('SELECT 1 FROM borrowers WHERE id = ?'); $q->execute([$pid]);
            if (!$q->fetchColumn()) fail('Choose a borrower.');
            $q = $pdo->prepare('SELECT 1 FROM books WHERE id = ? FOR UPDATE'); $q->execute([$bid]);
            if (!$q->fetchColumn()) fail('Choose a book.');
            if (available($pdo, $bid) < 1) fail('No copies of that book are available.');
            $pdo->prepare('INSERT INTO loans (borrower_id, book_id, borrowed, due) VALUES (?,?,?,?)')->execute([$pid, $bid, $borrowed, $due]);
            $pdo->commit();
            out(['ok' => true]);

        case 'return_loan':
            $pdo->prepare('UPDATE loans SET returned = CURDATE() WHERE id = ? AND returned IS NULL')->execute([(int)($in['id'] ?? 0)]);
            out(['ok' => true]);

        case 'delete_loan':
            $pdo->prepare('DELETE FROM loans WHERE id = ?')->execute([(int)($in['id'] ?? 0)]);
            out(['ok' => true]);

        case 'delete_borrower':
            $id = (int)($in['id'] ?? 0);
            if (hasActiveLoan($pdo, 'borrower_id', $id)) fail('This borrower still has books out.');
            $pdo->prepare('DELETE FROM borrowers WHERE id = ?')->execute([$id]);
            out(['ok' => true]);

        case 'delete_book':
            $id = (int)($in['id'] ?? 0);
            if (hasActiveLoan($pdo, 'book_id', $id)) fail('Copies of this book are still lent out.');
            $pdo->prepare('DELETE FROM books WHERE id = ?')->execute([$id]);
            out(['ok' => true]);

        default:
            fail('Unknown action.', 404);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('Database error. Please try again.', 500);
}
