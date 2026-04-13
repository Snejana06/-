from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from database import db, Task, UserProgress
from tasks_data import TASKS
import uuid
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///oge_trainer.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)

# Создание таблиц и наполнение БД заданиями
def init_database():
    with app.app_context():
        db.create_all()
        # Если база пустая, загружаем задания из TASKS
        if Task.query.count() == 0:
            for task_data in TASKS:
                task = Task(**task_data)
                db.session.add(task)
            db.session.commit()
            print(f"Загружено {len(TASKS)} заданий в базу данных")

# Главная страница
@app.route('/')
def index():
    return render_template('index.html')

# API: получить список тем и количество заданий
@app.route('/api/topics')
def get_topics():
    topics = db.session.query(Task.topic, Task.topic_id, db.func.count(Task.id))\
               .group_by(Task.topic, Task.topic_id).all()
    result = [{'name': t[0], 'id': t[1], 'count': t[2]} for t in topics]
    return jsonify(result)

# API: получить случайное задание (можно фильтровать по теме)
@app.route('/api/task')
def get_task():
    topic_id = request.args.get('topic')
    query = Task.query
    if topic_id and topic_id != 'all':
        query = query.filter_by(topic_id=topic_id)
    
    # Если передан task_id — вернуть конкретное
    task_id = request.args.get('id')
    if task_id:
        task = query.filter_by(id=task_id).first()
    else:
        task = query.order_by(db.func.random()).first()
    
    if not task:
        return jsonify({'error': 'Задания не найдены'}), 404
    
    return jsonify(task.to_dict())

# API: получить список заданий (для варианта)
@app.route('/api/variant')
def get_variant():
    topic_id = request.args.get('topic')
    limit = int(request.args.get('limit', 15))
    
    query = Task.query
    if topic_id and topic_id != 'all':
        query = query.filter_by(topic_id=topic_id)
    
    tasks = query.order_by(db.func.random()).limit(limit).all()
    return jsonify([t.to_dict() for t in tasks])

# API: проверка ответа
@app.route('/api/check', methods=['POST'])
def check_answer():
    data = request.json
    task_id = data.get('task_id')
    user_answer = str(data.get('answer', '')).strip()
    
    task = Task.query.get(task_id)
    if not task:
        return jsonify({'error': 'Задание не найдено'}), 404
    
    # Логика проверки (как в JS, но на сервере)
    is_correct = False
    
    if task.validator == 'number':
        try:
            user_num = float(user_answer.replace(',', '.'))
            correct_num = float(task.answer)
            if task.tolerance > 0:
                is_correct = abs(user_num - correct_num) <= task.tolerance
            else:
                is_correct = user_num == correct_num
        except ValueError:
            is_correct = False
    
    elif task.validator == 'set':
        user_set = set(user_answer.upper().replace(' ', '').split(','))
        correct_set = set(task.answer.upper().replace(' ', '').split(','))
        is_correct = user_set == correct_set
    
    else:  # text
        is_correct = user_answer.upper() == task.answer.upper()
    
    # Сохраняем прогресс (если есть session_id)
    session_id = data.get('session_id', 'anonymous')
    progress = UserProgress(
        session_id=session_id,
        task_id=task_id,
        is_correct=is_correct,
        user_answer=user_answer
    )
    db.session.add(progress)
    db.session.commit()
    
    return jsonify({
        'correct': is_correct,
        'right_answer': task.answer,
        'explanation': task.explanation
    })

# API: статистика пользователя
@app.route('/api/stats/<session_id>')
def get_stats(session_id):
    total = UserProgress.query.filter_by(session_id=session_id).count()
    correct = UserProgress.query.filter_by(session_id=session_id, is_correct=True).count()
    return jsonify({'total': total, 'correct': correct})

if __name__ == '__main__':
    init_database()
    app.run(debug=True, port=5000)
