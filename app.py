from flask import Flask, render_template, request, jsonify, send_file
import sqlite3
import json
import os

app = Flask(__name__, static_url_path='', static_folder='.', template_folder='.')

DB_FILE = 'budget.db'
JSON_FILE = 'budget_data.json'

# ---------- Database Setup ----------
def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS categories (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        budget REAL NOT NULL
                    )''')
        c.execute('''CREATE TABLE IF NOT EXISTS expenses (
                        id TEXT PRIMARY KEY,
                        category_id TEXT NOT NULL,
                        description TEXT NOT NULL,
                        amount REAL NOT NULL,
                        date TEXT NOT NULL,
                        FOREIGN KEY (category_id) REFERENCES categories (id)
                    )''')
        conn.commit()

init_db()

# ---------- Routes ----------
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/get_data', methods=['GET'])
def get_data():
    with sqlite3.connect(DB_FILE) as conn:
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
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO categories (id, name, budget) VALUES (?, ?, ?)",
                  (data['id'], data['name'], data['budget']))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category added successfully'})

@app.route('/delete_category/<category_id>', methods=['DELETE'])
def delete_category(category_id):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM categories WHERE id=?", (category_id,))
        c.execute("DELETE FROM expenses WHERE category_id=?", (category_id,))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category deleted successfully'})

@app.route('/add_expense', methods=['POST'])
def add_expense():
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("INSERT INTO expenses (id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?)",
                  (data['id'], data['category_id'], data['description'], data['amount'], data['date']))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Expense added successfully'})

@app.route('/delete_expense/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM expenses WHERE id=?", (expense_id,))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Expense deleted successfully'})

@app.route('/update_category/<category_id>', methods=['PUT'])
def update_category(category_id):
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("UPDATE categories SET name=?, budget=? WHERE id=?",
                  (data['name'], data['budget'], category_id))
        conn.commit()
    save_to_json()
    return jsonify({'message': 'Category updated successfully'})

@app.route('/update_expense/<expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
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
    with sqlite3.connect(DB_FILE) as conn:
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

if __name__ == '__main__':
    app.run(debug=True)
