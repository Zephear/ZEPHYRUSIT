import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt

app = Flask(__name__)
CORS(app)

app.config['JWT_SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key')
jwt = JWTManager(app)

# ==========================================
# DATABASE CONNECTION
# ==========================================
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
            print(f"Waiting for database... Retries left: {retries-1}")
            retries -= 1
            time.sleep(3)
    raise Exception("Could not connect to the database")

# ==========================================
# AUTHORIZATION
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Please enter username and password"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()

            if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                access_token = create_access_token(
                    identity=str(user['id']),
                    additional_claims={
                        'user_id': user['id'],
                        'username': user['username'],
                        'role': user['role']
                    }
                )
                
                return jsonify({
                    "message": "Login successful",
                    "access_token": access_token,
                    "user_id": user['id'],
                    "username": user['username'],
                    "role": user['role']
                }), 200
            else:
                return jsonify({"error": "Invalid username or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ==========================================
# REGISTRATION (ADMIN ONLY)
# ==========================================
@app.route('/api/register', methods=['POST'])
@jwt_required()
def register():
    claims = get_jwt()
    
    if claims.get('role') != 'admin':
        return jsonify({"error": "Only administrators can add new users."}), 403

    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')

    if not username or not password:
        return jsonify({"error": "Please enter username and password."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                return jsonify({"error": "User with this username already exists."}), 409

            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            cursor.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
                (username, hashed_password, role)
            )
        conn.commit()
        return jsonify({"message": f"User {username} successfully created!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ==========================================
# NEWS CRUD OPERATIONS
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
@jwt_required()
def create_news():
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"error": "Only administrators can create news."}), 403
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("INSERT INTO news (title, content) VALUES (%s, %s)", (data.get('title'), data.get('content')))
        conn.commit()
        return jsonify({"message": "News created"}), 201
    finally:
        conn.close()

@app.route('/api/news/<int:news_id>', methods=['PUT'])
@jwt_required()
def update_news(news_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"error": "Only administrators can update news."}), 403
    data = request.json
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE news SET title = %s, content = %s WHERE id = %s", (data.get('title'), data.get('content'), news_id))
        conn.commit()
        return jsonify({"message": "News updated"}), 200
    finally:
        conn.close()

@app.route('/api/news/<int:news_id>', methods=['DELETE'])
@jwt_required()
def delete_news(news_id):
    claims = get_jwt()
    if claims.get('role') != 'admin':
        return jsonify({"error": "Only administrators can delete news."}), 403
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM news WHERE id = %s", (news_id,))
        conn.commit()
        return jsonify({"message": "News deleted"}), 200
    finally:
        conn.close()

# ==========================================
# NOTES CRUD OPERATIONS
# ==========================================
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
        return jsonify({"error": "user_id and content are required"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if assignee:
                cursor.execute("SELECT id FROM users WHERE username = %s", (assignee,))
                existing_user = cursor.fetchone()
                if not existing_user:
                    return jsonify({"error": f"Error: Employee with username '{assignee}' does not exist."}), 404

            sql = "INSERT INTO notes (user_id, title, type, content, assignee, is_pinned) VALUES (%s, %s, %s, %s, %s, %s)"
            cursor.execute(sql, (user_id, title, note_type, content, assignee, is_pinned))
        conn.commit()
        return jsonify({"message": "Note created", "id": cursor.lastrowid}), 201
    finally:
        conn.close()

@app.route('/api/notes/<int:user_id>', methods=['GET'])
def get_notes(user_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            user_data = cursor.fetchone()
            username = user_data['username'] if user_data else ""

            sql = """
                SELECT id, title, type, content, is_pinned, is_completed, assignee 
                FROM notes 
                WHERE user_id = %s OR assignee = %s 
                ORDER BY is_pinned DESC, id DESC
            """
            cursor.execute(sql, (user_id, username))
            notes = cursor.fetchall()
            
            for note in notes:
                note['is_pinned'] = bool(note['is_pinned'])
                note['is_completed'] = bool(note['is_completed'])
                
            return jsonify(notes), 200
    finally:
        conn.close()

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
                return jsonify({"error": "Nothing to update"}), 400

            values.append(note_id)
            sql = f"UPDATE notes SET {', '.join(updates)} WHERE id = %s"
            cursor.execute(sql, values)
        conn.commit()
        return jsonify({"message": "Note updated"}), 200
    finally:
        conn.close()

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "DELETE FROM notes WHERE id = %s"
            cursor.execute(sql, (note_id,))
        conn.commit()
        return jsonify({"message": "Note deleted"}), 200
    finally:
        conn.close()

# ==========================================
# USER MANAGEMENT
# ==========================================
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
        return jsonify({"error": "Only administrators can delete users."}), 403

    if requester_id == user_id:
        return jsonify({"error": "You cannot delete your own account."}), 400

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cursor.fetchone():
                return jsonify({"error": "User not found."}), 404
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        return jsonify({"message": "User successfully deleted."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ==========================================
# APP RUNNER
# ==========================================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)