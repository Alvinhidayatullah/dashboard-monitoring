from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.String(50), nullable=False)  # Not Started, In Progress, On Track, Delayed, Completed
    priority = db.Column(db.String(20), nullable=False)  # Low, Medium, High, Critical
    start_date = db.Column(db.String(10), nullable=False)
    end_date = db.Column(db.String(10), nullable=False)
    budget = db.Column(db.Float, nullable=False)
    actual_cost = db.Column(db.Float, default=0)
    location = db.Column(db.String(100))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    progress = db.Column(db.Float, default=0)  # 0-100
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tasks = db.relationship('Task', backref='project', cascade='all, delete-orphan', lazy=True)
    assignments = db.relationship('Assignment', backref='project', cascade='all, delete-orphan', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'priority': self.priority,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'budget': self.budget,
            'actual_cost': self.actual_cost,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'progress': self.progress,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def get_s_curve_data(self):
        """Generate S-curve data for this project"""
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        # Calculate planned progress (ideal S-curve)
        planned = []
        actual = []
        
        # Simplified logic
        for i in range(12):
            month_progress = min(100, (i + 1) * 100 / 12)
            planned.append(round(month_progress, 1))
            
            # Actual progress based on current progress
            if i < 6:  # First half of the year
                actual_progress = min(self.progress, month_progress)
                actual.append(round(actual_progress * 0.8, 1))  # Simulate 80% efficiency
            else:  # Second half
                actual_progress = min(self.progress, month_progress)
                actual.append(round(actual_progress * 0.9, 1))  # Simulate 90% efficiency
        
        return {
            'labels': months,
            'planned': planned,
            'actual': actual
        }

class NonProject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # Internal, Meeting, Training, Maintenance
    description = db.Column(db.Text)
    status = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.String(10), nullable=False)
    end_date = db.Column(db.String(10), nullable=False)
    budget = db.Column(db.Float, nullable=False)
    actual_cost = db.Column(db.Float, default=0)
    progress = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tasks = db.relationship('Task', backref='non_project', cascade='all, delete-orphan', lazy=True)
    assignments = db.relationship('Assignment', backref='non_project', cascade='all, delete-orphan', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'category': self.category,
            'description': self.description,
            'status': self.status,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'budget': self.budget,
            'actual_cost': self.actual_cost,
            'progress': self.progress,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # Foreign keys
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))
    non_project_id = db.Column(db.Integer, db.ForeignKey('non_project.id'))
    
    pic = db.Column(db.String(100), nullable=False)
    due_date = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(50), nullable=False)  # Not Started, In Progress, Completed, Delayed
    action_plan = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), nullable=False)
    progress = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'project_id': self.project_id,
            'non_project_id': self.non_project_id,
            'pic': self.pic,
            'due_date': self.due_date,
            'status': self.status,
            'action_plan': self.action_plan,
            'priority': self.priority,
            'progress': self.progress,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ManPower(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    position = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    skills = db.Column(db.Text)
    availability = db.Column(db.Float, default=100)  # Percentage
    total_hours = db.Column(db.Integer, default=40)  # Hours per week
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    assignments = db.relationship('Assignment', backref='manpower', cascade='all, delete-orphan', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'position': self.position,
            'department': self.department,
            'skills': self.skills,
            'availability': self.availability,
            'total_hours': self.total_hours,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    
    # Foreign keys
    manpower_id = db.Column(db.Integer, db.ForeignKey('man_power.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'))
    non_project_id = db.Column(db.Integer, db.ForeignKey('non_project.id'))
    
    role = db.Column(db.String(100), nullable=False)
    hours_per_week = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.String(10))
    end_date = db.Column(db.String(10))
    status = db.Column(db.String(50), default='Active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'manpower_id': self.manpower_id,
            'project_id': self.project_id,
            'non_project_id': self.non_project_id,
            'role': self.role,
            'hours_per_week': self.hours_per_week,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }