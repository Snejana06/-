from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Task(db.Model):
    """Модель задания из банка"""
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(100), nullable=False)
    topic_id = db.Column(db.String(20), nullable=False)
    task_num = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=False)
    answer = db.Column(db.String(255), nullable=False)
    validator = db.Column(db.String(20), default='text')  # text, number, set
    tolerance = db.Column(db.Float, default=0.0)
    explanation = db.Column(db.Text, default='')
    
    def to_dict(self):
        return {
            'id': self.id,
            'topic': self.topic,
            'topic_id': self.topic_id,
            'task_num': self.task_num,
            'text': self.text,
            'answer': self.answer,
            'validator': self.validator,
            'tolerance': self.tolerance,
            'explanation': self.explanation
        }

class UserProgress(db.Model):
    """Прогресс пользователя"""
    __tablename__ = 'user_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'))
    is_correct = db.Column(db.Boolean, default=False)
    user_answer = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    task = db.relationship('Task')
