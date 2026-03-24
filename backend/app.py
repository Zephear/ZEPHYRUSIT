import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import bcrypt

app = Flask(__name__)
CORS(app)

def get_db_connection():
    retries = 5
    while retries > 0:
        try:
            connection = pymysql.connect(
                host=os.environ.get('DB_HOST', 'database'),
                user=os.environ.get('DB_USER'),
                password=os.environ.get('DB_PASSWORD'),
                database=os.environ.get('DB_NAME'),
                cursorclass=pymysql.cursors.DictCursor
            )
            return connection
        except pymysql.MySQLError as e:
            print(f"Очікування бази даних... Залишилось спроб: {retries-1}")
            retries -= 1
            time.sleep(3)
    raise Exception("Не вдалося підключитися до бази даних")

# ==========================================
# АВТОРИЗАЦІЯ
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Введіть логін та пароль"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()

            if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                return jsonify({
                    "message": "Успішний вхід",
                    "user_id": user['id'],
                    "username": user['username'],
                    "role": user['role']
                }), 200
            else:
                return jsonify({"error": "Невірний логін або пароль"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# РЕЄСТРАЦІЯ (ТІЛЬКИ ДЛЯ АДМІНІСТРАТОРІВ)
# ==========================================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    requester_role = data.get('requester_role') # Перевірка ролі того, хто робить запит
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    # Серверна перевірка, щоб тільки адмін міг створити юзера
    if requester_role != 'admin':
        return jsonify({"error": "Тільки адміністратор може додавати нових користувачів."}), 403

    if not username or not password:
        return jsonify({"error": "Введіть логін та пароль."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Перевіряємо, чи такий користувач вже існує
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                return jsonify({"error": "Користувач з таким логіном вже існує."}), 409

            # Хешуємо пароль перед збереженням
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            # Зберігаємо в базу
            cursor.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                (username, hashed_password, role)
            )
        conn.commit()
        return jsonify({"message": f"Користувача {username} успішно створено!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ==========================================
# CRUD ОПЕРАЦІЇ ДЛЯ НОВИН
# ==========================================

@app.route('/api/news', methods=['GET'])
def get_news():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM news ORDER BY id DESC")
            return jsonify(cursor.fetchall()), 200
    finally:
        conn.close()

@app.route('/api/news', methods=['POST'])
def create_news():
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("INSERT INTO news (title, content) VALUES (%s, %s)", (data.get('title'), data.get('content')))
        conn.commit()
        return jsonify({"message": "Новину створено"}), 201
    finally:
        conn.close()

@app.route('/api/news/<int:news_id>', methods=['PUT'])
def update_news(news_id):
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE news SET title = %s, content = %s WHERE id = %s", (data.get('title'), data.get('content'), news_id))
        conn.commit()
        return jsonify({"message": "Новину оновлено"}), 200
    finally:
        conn.close()

@app.route('/api/news/<int:news_id>', methods=['DELETE'])
def delete_news(news_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM news WHERE id = %s", (news_id,))
        conn.commit()
        return jsonify({"message": "Новину видалено"}), 200
    finally:
        conn.close()

# ==========================================
# CRUD ОПЕРАЦІЇ ДЛЯ НОТАТОК
# ==========================================

# CREATE
# CREATE
@app.route('/api/notes', methods=['POST'])
def create_note():
    data = request.json
    user_id = data.get('user_id')
    title = data.get('title', 'Untitled')
    content = data.get('content')
    note_type = data.get('type', 'All Notes')
    assignee = data.get('assignee', None)
    is_pinned = data.get('is_pinned', False)

    if not user_id or not content:
        return jsonify({"error": "user_id та content обов'язкові"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # --- НОВЕ: Перевірка, чи існує assignee в базі ---
            if assignee:
                cursor.execute("SELECT id FROM users WHERE username = %s", (assignee,))
                existing_user = cursor.fetchone()
                if not existing_user:
                    # Якщо юзера немає, повертаємо статус 404 (Not Found)
                    return jsonify({"error": f"Помилка: Працівника з логіном '{assignee}' не існує."}), 404
            # --------------------------------------------------

            sql = "INSERT INTO notes (user_id, title, type, content, assignee, is_pinned) VALUES (%s, %s, %s, %s, %s, %s)"
            cursor.execute(sql, (user_id, title, note_type, content, assignee, is_pinned))
        conn.commit()
        return jsonify({"message": "Нотатку створено", "id": cursor.lastrowid}), 201
    finally:
        conn.close()
# READ
# READ
@app.route('/api/notes/<int:user_id>', methods=['GET'])
def get_notes(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 1. Спочатку дізнаємося username користувача за його ID
            cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            user_data = cursor.fetchone()
            username = user_data['username'] if user_data else ""

            # 2. Вибираємо нотатки, які СТВОРИВ цей користувач (user_id = %s)
            # АБО які ПРИЗНАЧЕНІ йому як завдання (assignee = %s)
            sql = """
                SELECT id, title, type, content, is_pinned, is_completed, assignee 
                FROM notes 
                WHERE user_id = %s OR assignee = %s 
                ORDER BY is_pinned DESC, id DESC
            """
            cursor.execute(sql, (user_id, username))
            notes = cursor.fetchall()
            
            # Конвертуємо булеві значення для фронтенду
            for note in notes:
                note['is_pinned'] = bool(note['is_pinned'])
                note['is_completed'] = bool(note['is_completed'])
                
            return jsonify(notes), 200
    finally:
        conn.close()

# UPDATE
@app.route('/api/notes/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    data = request.json
    new_content = data.get('content')
    new_title = data.get('title')
    is_pinned = data.get('is_pinned')
    is_completed = data.get('is_completed')

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            updates = []
            values = []
            if new_content is not None:
                updates.append("content = %s")
                values.append(new_content)
            if new_title is not None:
                updates.append("title = %s")
                values.append(new_title)
            if is_pinned is not None:
                updates.append("is_pinned = %s")
                values.append(is_pinned)
            if is_completed is not None:
                updates.append("is_completed = %s")
                values.append(is_completed)

            if not updates:
                return jsonify({"error": "Нічого для оновлення"}), 400

            values.append(note_id)
            sql = f"UPDATE notes SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(sql, values)
        conn.commit()
        return jsonify({"message": "Нотатку оновлено"}), 200
    finally:
        conn.close()

# DELETE
@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "DELETE FROM notes WHERE id = %s"
            cursor.execute(sql, (note_id,))
        conn.commit()
        return jsonify({"message": "Нотатку видалено"}), 200
    finally:
        conn.close()


@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username, role FROM users ORDER BY id ASC")
            return jsonify(cursor.fetchall()), 200
    finally:
        conn.close()

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    data = request.json
    requester_id = data.get('requester_id')
    requester_role = data.get('requester_role')

    if requester_role != 'admin':
        return jsonify({"error": "Тільки адміністратор може видаляти користувачів."}), 403

    if requester_id == user_id:
        return jsonify({"error": "Не можна видалити власний акаунт."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cursor.fetchone():
                return jsonify({"error": "Користувача не знайдено."}), 404
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return jsonify({"message": "Користувача успішно видалено."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)