import sqlite3
import json
import os
import glob
from flask import Flask, render_template, request, jsonify, send_file, session


app = Flask(__name__, static_url_path='', static_folder='.', template_folder='.')

app.secret_key = "supersecretkey"


DB_FILE = 'budget.db'
JSON_FILE = 'budget_data.json'

def get_db_file():
    return session.get("db_file", "budget.db")

def init_db(db_file):
    with sqlite3.connect(db_file) as conn:
        c = conn.cursor()
        # Categories table
        c.execute('''CREATE TABLE IF NOT EXISTS categories (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        budget REAL NOT NULL
                    )''')
        # Expenses table
        c.execute('''CREATE TABLE IF NOT EXISTS expenses (
                        id TEXT PRIMARY KEY,
                        category_id TEXT NOT NULL,
                        description TEXT NOT NULL,
                        amount REAL NOT NULL,
                        date TEXT NOT NULL,
                        FOREIGN KEY (category_id) REFERENCES categories (id)
                    )''')
        # Salary
        c.execute('''CREATE TABLE IF NOT EXISTS salary (
                        id INTEGER PRIMARY KEY CHECK (id=1),
                        amount REAL NOT NULL
                    )''')
        c.execute("INSERT OR IGNORE INTO salary (id, amount) VALUES (1, 0)")
        # Default Misc
        c.execute("INSERT OR IGNORE INTO categories (id, name, budget) VALUES (?,?,?)",
                  ("misc_cat", "Miscellaneous / Unknown", 0.0))
        conn.commit()

@app.route('/list_dbs')
def list_dbs():
    dbs = [os.path.basename(f) for f in glob.glob("*.db")]
    if "budget.db" not in dbs and os.path.exists("budget.db"):
        dbs.insert(0, "budget.db")
    active = get_db_file()
    return jsonify({"databases": dbs, "active": active})

@app.route('/create_db', methods=['POST'])
def create_db():
    data = request.json
    dbname = data.get("dbname").strip()
    if not dbname.endswith(".db"):
        dbname += ".db"
    if os.path.exists(dbname):
        return jsonify({"error": "Database already exists"}), 400
    init_db(dbname)
    return jsonify({"message": f"Database {dbname} created", "dbname": dbname})

@app.route('/switch_db/<dbname>', methods=['POST'])
def switch_db(dbname):
    if not dbname.endswith(".db"):
        return jsonify({"error": "Invalid database"}), 400
    session["db_file"] = dbname
    if not os.path.exists(dbname):
        init_db(dbname)
    return jsonify({"message": f"Switched to {dbname}"})

@app.route('/get_salary', methods=['GET'])
def get_salary():
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("SELECT amount FROM salary WHERE id=1")
        row = c.fetchone()
        return jsonify({'salary': row[0] if row else 0})

@app.route('/update_salary', methods=['POST'])
def update_salary():
    data = request.json
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("UPDATE salary SET amount=? WHERE id=1", (data['amount'],))
        conn.commit()
    return jsonify({'message': 'Salary updated successfully'})

init_db("budget.db")

# ---------- Routes ----------
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/get_data', methods=['GET'])
def get_data():
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("SELECT * FROM categories")
        categories = [{'id': row[0], 'name': row[1], 'budget': row[2]} for row in c.fetchall()]
        
        c.execute("SELECT * FROM expenses")
        expenses = {}
        for row in c.fetchall():
            if row[1] not in expenses:
                expenses[row[1]] = []
            expenses[row[1]].append({
                'id': row[0],
                'description': row[2],
                'amount': row[3],
                'date': row[4]
            })

    return jsonify({'categories': categories, 'expenses': expenses})

@app.route('/add_category', methods=['POST'])
def add_category():
    data = request.json
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("INSERT INTO categories (id, name, budget) VALUES (?, ?, ?)",
                  (data['id'], data['name'], data['budget']))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category added successfully'})

@app.route('/delete_category/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("DELETE FROM categories WHERE id=?", (category_id,))
        c.execute("DELETE FROM expenses WHERE category_id=?", (category_id,))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category deleted successfully'})

@app.route('/add_expense', methods=['POST'])
def add_expense():
    data = request.json
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("INSERT INTO expenses (id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?)",
                  (data['id'], data['category_id'], data['description'], data['amount'], data['date']))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Expense added successfully'})

@app.route('/delete_expense/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Expense deleted successfully'})

@app.route('/update_category/<category_id>', methods=['PUT'])
def update_category(category_id):
    data = request.json
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("UPDATE categories SET name=?, budget=? WHERE id=?",
                  (data['name'], data['budget'], category_id))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category updated successfully'})

@app.route('/update_expense/<expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("UPDATE expenses SET description=?, amount=? WHERE id=?",
                  (data['description'], data['amount'], expense_id))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Expense updated successfully'})

@app.route('/export_json', methods=['GET'])
def export_json():
    save_to_json()
    return send_file(JSON_FILE, as_attachment=True)

# ---------- Helpers ----------
def save_to_json():
    with sqlite3.connect(get_db_file()) as conn:

        c = conn.cursor()
        c.execute("SELECT * FROM categories")
        categories = [{'id': row[0], 'name': row[1], 'budget': row[2]} for row in c.fetchall()]
        
        c.execute("SELECT * FROM expenses")
        expenses = {}
        for row in c.fetchall():
            if row[1] not in expenses:
                expenses[row[1]] = []
            expenses[row[1]].append({
                'id': row[0],
                'description': row[2],
                'amount': row[3],
                'date': row[4]
            })

    with open(JSON_FILE, 'w') as f:
        json.dump({'categories': categories, 'expenses': expenses}, f, indent=4)

if __name__ == "__main__":
    init_db("budget.db")   # ✅ create/ensure default db exists
    app.run(debug=True)
