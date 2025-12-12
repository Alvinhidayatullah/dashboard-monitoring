from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from models import db, Project, NonProject, Task, ManPower, Assignment
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Inisialisasi Flask
app = Flask(__name__)
CORS(app)

# ========== KONFIGURASI DATABASE UNTUK RENDER.COM ==========
basedir = os.path.abspath(os.path.dirname(__file__))

# Konfigurasi untuk Render (PostgreSQL) atau local (SQLite)
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    
if DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    print(f"✓ Menggunakan PostgreSQL: {DATABASE_URL[:50]}...")
else:
    # Fallback ke SQLite untuk development
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "monitoring.db")}'
    print("✓ Menggunakan SQLite untuk development")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inisialisasi SQLAlchemy dengan app
db.init_app(app)

# ========== NON-PROJECT API (LENGKAP) ==========
@app.route('/api/non-projects/<int:non_project_id>', methods=['GET'])
def get_non_project(non_project_id):
    with app.app_context():
        non_project = NonProject.query.get_or_404(non_project_id)
        return jsonify(non_project.to_dict())

@app.route('/api/non-projects/<int:non_project_id>', methods=['PUT'])
def update_non_project(non_project_id):
    try:
        with app.app_context():
            non_project = NonProject.query.get_or_404(non_project_id)
            data = request.json
            
            # Update fields
            for key, value in data.items():
                if hasattr(non_project, key):
                    if key in ['budget', 'actual_cost', 'progress']:
                        setattr(non_project, key, float(value) if value else None)
                    else:
                        setattr(non_project, key, value)
            
            db.session.commit()
            return jsonify(non_project.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/non-projects/<int:non_project_id>/tasks', methods=['GET'])
def get_non_project_tasks(non_project_id):
    with app.app_context():
        tasks = Task.query.filter_by(non_project_id=non_project_id).all()
        return jsonify([t.to_dict() for t in tasks])

# ========== ROUTES ==========
@app.route('/')
def index():
    """Render main dashboard"""
    return render_template('index.html')

# ========== PROJECT API ==========
@app.route('/api/projects', methods=['GET'])
def get_projects():
    with app.app_context():
        projects = Project.query.all()
        return jsonify([p.to_dict() for p in projects])

@app.route('/api/projects/<int:project_id>', methods=['GET'])
def get_project(project_id):
    with app.app_context():
        project = Project.query.get_or_404(project_id)
        return jsonify(project.to_dict())

@app.route('/api/projects', methods=['POST'])
def create_project():
    try:
        data = request.json
        
        # Handle coordinates
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude:
            latitude = float(latitude)
        if longitude:
            longitude = float(longitude)
        
        with app.app_context():
            project = Project(
                name=data['name'],
                description=data.get('description', ''),
                status=data.get('status', 'Not Started'),
                priority=data.get('priority', 'Medium'),
                start_date=data['start_date'],
                end_date=data['end_date'],
                budget=float(data['budget']),
                actual_cost=float(data.get('actual_cost', 0)),
                location=data.get('location', ''),
                latitude=latitude,
                longitude=longitude,
                progress=float(data.get('progress', 0))
            )
            
            db.session.add(project)
            db.session.commit()
            
            return jsonify(project.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    try:
        with app.app_context():
            project = Project.query.get_or_404(project_id)
            data = request.json
            
            # Update fields
            for key, value in data.items():
                if hasattr(project, key):
                    if key in ['budget', 'actual_cost', 'progress', 'latitude', 'longitude']:
                        setattr(project, key, float(value) if value else None)
                    else:
                        setattr(project, key, value)
            
            db.session.commit()
            return jsonify(project.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        with app.app_context():
            project = Project.query.get_or_404(project_id)
            db.session.delete(project)
            db.session.commit()
            return jsonify({'message': 'Project deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/projects/<int:project_id>/s-curve', methods=['GET'])
def get_project_s_curve(project_id):
    with app.app_context():
        project = Project.query.get_or_404(project_id)
        return jsonify(project.get_s_curve_data())

@app.route('/api/projects/<int:project_id>/tasks', methods=['GET'])
def get_project_tasks(project_id):
    with app.app_context():
        tasks = Task.query.filter_by(project_id=project_id).all()
        return jsonify([t.to_dict() for t in tasks])

@app.route('/api/projects/<int:project_id>/assignments', methods=['GET'])
def get_project_assignments(project_id):
    with app.app_context():
        assignments = Assignment.query.filter_by(project_id=project_id).all()
        return jsonify([a.to_dict() for a in assignments])

# ========== NON-PROJECT API ==========
@app.route('/api/non-projects', methods=['GET'])
def get_non_projects():
    with app.app_context():
        non_projects = NonProject.query.all()
        return jsonify([np.to_dict() for np in non_projects])

@app.route('/api/non-projects', methods=['POST'])
def create_non_project():
    try:
        data = request.json
        with app.app_context():
            non_project = NonProject(
                name=data['name'],
                category=data.get('category', 'Internal'),
                description=data.get('description', ''),
                status=data.get('status', 'Not Started'),
                start_date=data['start_date'],
                end_date=data['end_date'],
                budget=float(data['budget']),
                actual_cost=float(data.get('actual_cost', 0)),
                progress=float(data.get('progress', 0))
            )
            
            db.session.add(non_project)
            db.session.commit()
            return jsonify(non_project.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/non-projects/<int:non_project_id>', methods=['DELETE'])
def delete_non_project(non_project_id):
    try:
        with app.app_context():
            non_project = NonProject.query.get_or_404(non_project_id)
            db.session.delete(non_project)
            db.session.commit()
            return jsonify({'message': 'Non-project deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ========== TASK API ==========
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    project_id = request.args.get('project_id')
    non_project_id = request.args.get('non_project_id')
    
    with app.app_context():
        query = Task.query
        if project_id:
            query = query.filter_by(project_id=project_id)
        elif non_project_id:
            query = query.filter_by(non_project_id=non_project_id)
        
        tasks = query.all()
        return jsonify([t.to_dict() for t in tasks])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    try:
        data = request.json
        with app.app_context():
            task = Task(
                name=data['name'],
                description=data.get('description', ''),
                project_id=data.get('project_id'),
                non_project_id=data.get('non_project_id'),
                pic=data['pic'],
                due_date=data['due_date'],
                status=data.get('status', 'Not Started'),
                action_plan=data['action_plan'],
                priority=data.get('priority', 'Medium'),
                progress=float(data.get('progress', 0))
            )
            
            db.session.add(task)
            db.session.commit()
            return jsonify(task.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        with app.app_context():
            task = Task.query.get_or_404(task_id)
            db.session.delete(task)
            db.session.commit()
            return jsonify({'message': 'Task deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ========== MANPOWER API ==========
@app.route('/api/manpower', methods=['GET'])
def get_manpower():
    with app.app_context():
        manpower = ManPower.query.all()
        return jsonify([mp.to_dict() for mp in manpower])

@app.route('/api/manpower', methods=['POST'])
def create_manpower():
    try:
        data = request.json
        with app.app_context():
            manpower = ManPower(
                name=data['name'],
                email=data.get('email', ''),
                position=data['position'],
                department=data['department'],
                skills=data.get('skills', ''),
                availability=float(data.get('availability', 100)),
                total_hours=int(data.get('total_hours', 40))
            )
            
            db.session.add(manpower)
            db.session.commit()
            return jsonify(manpower.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/manpower/<int:manpower_id>', methods=['GET'])
def get_manpower_detail(manpower_id):
    with app.app_context():
        manpower = ManPower.query.get_or_404(manpower_id)
        return jsonify(manpower.to_dict())

@app.route('/api/manpower/<int:manpower_id>', methods=['PUT'])
def update_manpower(manpower_id):
    try:
        with app.app_context():
            manpower = ManPower.query.get_or_404(manpower_id)
            data = request.json
            
            # Update fields
            for key, value in data.items():
                if hasattr(manpower, key):
                    if key in ['availability', 'total_hours']:
                        setattr(manpower, key, float(value) if value else None)
                    else:
                        setattr(manpower, key, value)
            
            db.session.commit()
            return jsonify(manpower.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/manpower/<int:manpower_id>', methods=['DELETE'])
def delete_manpower(manpower_id):
    try:
        with app.app_context():
            manpower = ManPower.query.get_or_404(manpower_id)
            db.session.delete(manpower)
            db.session.commit()
            return jsonify({'message': 'Manpower deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/manpower/<int:manpower_id>/assignments', methods=['GET'])
def get_manpower_assignments(manpower_id):
    with app.app_context():
        assignments = Assignment.query.filter_by(manpower_id=manpower_id).all()
        return jsonify([a.to_dict() for a in assignments])

# ========== ASSIGNMENT API ==========
@app.route('/api/assignments', methods=['GET'])
def get_assignments():
    with app.app_context():
        assignments = Assignment.query.all()
        return jsonify([a.to_dict() for a in assignments])

@app.route('/api/assignments', methods=['POST'])
def create_assignment():
    try:
        data = request.json
        with app.app_context():
            assignment = Assignment(
                manpower_id=data['manpower_id'],
                project_id=data.get('project_id'),
                non_project_id=data.get('non_project_id'),
                role=data['role'],
                hours_per_week=int(data['hours_per_week']),
                start_date=data.get('start_date'),
                end_date=data.get('end_date'),
                status=data.get('status', 'Active')
            )
            
            db.session.add(assignment)
            db.session.commit()
            return jsonify(assignment.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    try:
        with app.app_context():
            assignment = Assignment.query.get_or_404(assignment_id)
            db.session.delete(assignment)
            db.session.commit()
            return jsonify({'message': 'Assignment deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ========== DASHBOARD SUMMARY API ==========
@app.route('/api/summary', methods=['GET'])
def get_summary():
    with app.app_context():
        # Get counts
        total_projects = Project.query.count()
        total_non_projects = NonProject.query.count()
        total_manpower = ManPower.query.count()
        
        # Get financial data
        total_budget = sum(p.budget for p in Project.query.all()) + sum(np.budget for np in NonProject.query.all())
        total_actual = sum(p.actual_cost for p in Project.query.all()) + sum(np.actual_cost for np in NonProject.query.all())
        
        # Get priority projects
        priority_projects = Project.query.filter(Project.priority.in_(['High', 'Critical'])).order_by(Project.end_date).limit(5).all()
        
        # Get projects for map
        projects_with_location = Project.query.filter(Project.latitude.isnot(None), Project.longitude.isnot(None)).all()
        locations = []
        for project in projects_with_location:
            if project.latitude and project.longitude:
                locations.append({
                    'name': project.name,
                    'location': project.location,
                    'lat': project.latitude,
                    'lng': project.longitude,
                    'status': project.status,
                    'priority': project.priority
                })
        
        # Overall S-curve (simplified)
        months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        overall_s_curve = {
            'labels': months,
            'planned': [10, 25, 45, 65, 80, 90, 95, 97, 98, 99, 100, 100],
            'actual': [8, 20, 38, 55, 70, 82, 88, 91, 93, 95, 96, 97]
        }
        
        # Status distribution
        status_counts = {}
        for project in Project.query.all():
            status = project.status
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Priority distribution
        priority_counts = {}
        for project in Project.query.all():
            priority = project.priority
            priority_counts[priority] = priority_counts.get(priority, 0) + 1
        
        # Get priority tasks
        priority_tasks = Task.query.filter(Task.priority.in_(['High', 'Critical'])).order_by(Task.due_date).limit(5).all()
        
        return jsonify({
            'total_projects': total_projects,
            'total_non_projects': total_non_projects,
            'total_manpower': total_manpower,
            'total_budget': total_budget,
            'total_actual': total_actual,
            'priority_projects': [p.to_dict() for p in priority_projects],
            'priority_tasks': [t.to_dict() for t in priority_tasks],
            'locations': locations,
            'overall_s_curve': overall_s_curve,
            'status_distribution': status_counts,
            'priority_distribution': priority_counts,
            'budget_variance': total_budget - total_actual
        })

# ========== INITIALIZE DATABASE ==========
def init_database():
    """Initialize database with sample data"""
    with app.app_context():
        # Create tables
        db.create_all()
        
        # Check if we need sample data
        if Project.query.count() == 0:
            print("Adding sample data...")
            add_sample_data()
            print("Sample data added!")
        else:
            print(f"Database already has {Project.query.count()} projects")

def add_sample_data():
    """Add comprehensive sample data"""
    with app.app_context():
        # Sample manpower
        manpower_list = [
            ManPower(name="John Doe", position="Project Manager", department="IT", 
                    email="john@example.com", skills="Python, Flask, Project Management", total_hours=40),
            ManPower(name="Jane Smith", position="Frontend Developer", department="IT",
                    email="jane@example.com", skills="JavaScript, React, CSS", total_hours=40),
            ManPower(name="Bob Wilson", position="Backend Developer", department="IT",
                    email="bob@example.com", skills="Python, Django, API", total_hours=40),
            ManPower(name="Alice Johnson", position="UI/UX Designer", department="Creative",
                    email="alice@example.com", skills="Figma, Adobe XD, User Research", total_hours=35),
            ManPower(name="Charlie Brown", position="QA Engineer", department="Testing",
                    email="charlie@example.com", skills="Testing, Automation, Selenium", total_hours=40),
        ]
        
        for mp in manpower_list:
            db.session.add(mp)
        db.session.commit()
        
        # Sample projects
        projects = [
            Project(
                name="Website E-commerce",
                description="Development of online store platform",
                status="In Progress",
                priority="High",
                start_date="2024-01-01",
                end_date="2024-06-30",
                budget=500000000,
                actual_cost=250000000,
                location="Jakarta",
                latitude=-6.2088,
                longitude=106.8456,
                progress=50
            ),
            Project(
                name="Mobile Banking App",
                description="Mobile application for banking services",
                status="On Track",
                priority="Critical",
                start_date="2024-02-01",
                end_date="2024-09-30",
                budget=750000000,
                actual_cost=300000000,
                location="Surabaya",
                latitude=-7.2575,
                longitude=112.7521,
                progress=40
            ),
            Project(
                name="ERP System Implementation",
                description="Enterprise resource planning system",
                status="Delayed",
                priority="High",
                start_date="2024-03-01",
                end_date="2024-12-31",
                budget=1000000000,
                actual_cost=400000000,
                location="Bandung",
                latitude=-6.9175,
                longitude=107.6191,
                progress=35
            ),
        ]
        
        for p in projects:
            db.session.add(p)
        db.session.commit()
        
        # Sample non-projects
        non_projects = [
            NonProject(
                name="Annual Team Training",
                category="Training",
                description="Yearly technical training for team",
                status="Completed",
                start_date="2024-01-15",
                end_date="2024-01-20",
                budget=50000000,
                actual_cost=45000000,
                progress=100
            ),
            NonProject(
                name="Quarterly Meeting",
                category="Meeting",
                description="Q1 performance review meeting",
                status="In Progress",
                start_date="2024-03-01",
                end_date="2024-03-05",
                budget=10000000,
                actual_cost=7500000,
                progress=75
            ),
        ]
        
        for np in non_projects:
            db.session.add(np)
        db.session.commit()
        
        # Sample tasks for projects
        tasks = [
            Task(
                project_id=1,
                name="Design Database Schema",
                description="Design and implement database structure",
                pic="John Doe",
                due_date="2024-02-15",
                status="Completed",
                action_plan="Create ERD diagram and implement in PostgreSQL",
                priority="High",
                progress=100
            ),
            Task(
                project_id=1,
                name="Develop User Authentication",
                description="Implement login and registration system",
                pic="Jane Smith",
                due_date="2024-03-31",
                status="In Progress",
                action_plan="Create JWT authentication with role-based access",
                priority="High",
                progress=70
            ),
            Task(
                project_id=2,
                name="API Development",
                description="Create REST APIs for mobile app",
                pic="Bob Wilson",
                due_date="2024-04-30",
                status="In Progress",
                action_plan="Develop endpoints for banking transactions",
                priority="Critical",
                progress=60
            ),
        ]
        
        for t in tasks:
            db.session.add(t)
        db.session.commit()
        
        # Sample assignments
        assignments = [
            Assignment(manpower_id=1, project_id=1, role="Project Lead", hours_per_week=20),
            Assignment(manpower_id=1, project_id=2, role="Consultant", hours_per_week=10),
            Assignment(manpower_id=2, project_id=1, role="Frontend Lead", hours_per_week=30),
            Assignment(manpower_id=3, project_id=2, role="Backend Lead", hours_per_week=35),
            Assignment(manpower_id=4, project_id=1, role="UI Designer", hours_per_week=25),
            Assignment(manpower_id=5, project_id=2, role="QA Lead", hours_per_week=20),
            Assignment(manpower_id=2, non_project_id=1, role="Trainer", hours_per_week=10),
        ]
        
        for a in assignments:
            db.session.add(a)
        db.session.commit()

# ========== RUN APPLICATION ==========
if __name__ == '__main__':
    print("=" * 60)
    print("DASHBOARD MONITORING - PERTAMINA STYLE")
    print("=" * 60)
    
    # Check if database exists (hanya untuk SQLite)
    if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
        db_path = os.path.join(basedir, "monitoring.db")
        if os.path.exists(db_path):
            print(f"✓ Database ditemukan: {db_path}")
            print("  Menggunakan database yang ada...")
        else:
            print(f"✗ Database tidak ditemukan")
            print("  Membuat database baru...")
    
    # Initialize database
    init_database()
    
    print("\n" + "=" * 60)
    print("🚀 Server berjalan di: http://localhost:5000")
    print("📊 Dashboard siap digunakan!")
    print("=" * 60 + "\n")
    
    # Untuk Render.com, gunakan port dari environment variable
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)