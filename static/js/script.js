// ===== CONFIGURATION =====
// Config untuk development vs production
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = IS_DEVELOPMENT ? 'http://localhost:5000' : '';

// ===== GLOBAL VARIABLES =====
let currentProjectId = null;
let currentManPowerId = null;
let map = null;
let charts = {};
let refreshInterval = null;
let projectsData = [];
let manpowerData = [];

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized with API URL:', API_BASE_URL);
    
    // Set tab pertama sebagai aktif
    switchTab('summary');
    
    // Load initial data
    loadAllData();
    
    // Initialize map
    initMap();
    
    // Set up auto-refresh every 30 seconds
    refreshInterval = setInterval(loadAllData, 30000);
    
    // Setup modal event listeners
    setupModalEventListeners();
    
    // Setup assignment modal selection
    document.getElementById('assignmentTarget')?.addEventListener('change', function() {
        const projectDiv = document.getElementById('projectSelection');
        const nonProjectDiv = document.getElementById('nonProjectSelection');
        
        if (this.value === 'project') {
            if (projectDiv) projectDiv.style.display = 'block';
            if (nonProjectDiv) nonProjectDiv.style.display = 'none';
        } else if (this.value === 'non_project') {
            if (projectDiv) projectDiv.style.display = 'none';
            if (nonProjectDiv) nonProjectDiv.style.display = 'block';
        } else {
            if (projectDiv) projectDiv.style.display = 'none';
            if (nonProjectDiv) nonProjectDiv.style.display = 'none';
        }
    });
});

// ===== TAB NAVIGATION =====
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Update active tab in navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
    });
    
    // Set active tab
    const activeTab = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-current', 'page');
    }
    
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active', 'fade-in');
        
        // Load specific data for tab
        switch(tabName) {
            case 'summary':
                loadSummaryData();
                break;
            case 'projects':
                loadProjects();
                break;
            case 'non-projects':
                loadNonProjects();
                break;
            case 'manpower':
                loadManPower();
                break;
        }
    }
}

// ===== MAP FUNCTIONS =====
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;
    
    try {
        // Default center on Indonesia
        map = L.map('map').setView([-2.5489, 118.0149], 5);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        mapElement.innerHTML = `
            <div class="text-center text-danger py-5">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <div>Gagal memuat peta</div>
                <small>Periksa koneksi internet atau library Leaflet</small>
            </div>
        `;
    }
}

// ===== MODAL FUNCTIONS =====
function setupModalEventListeners() {
    // Clear forms when modal is hidden
    const modals = ['addProjectModal', 'addTaskModal', 'addManPowerModal', 'addNonProjectModal', 'addAssignmentModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('hidden.bs.modal', function() {
                const form = this.querySelector('form');
                if (form) {
                    form.reset();
                    // Reset assignment form visibility
                    if (modalId === 'addAssignmentModal') {
                        const projectDiv = document.getElementById('projectSelection');
                        const nonProjectDiv = document.getElementById('nonProjectSelection');
                        if (projectDiv) projectDiv.style.display = 'none';
                        if (nonProjectDiv) nonProjectDiv.style.display = 'none';
                        
                        // Reset target selection
                        const targetSelect = document.getElementById('assignmentTarget');
                        if (targetSelect) targetSelect.value = '';
                    }
                }
            });
        }
    });
}

// ===== DATA LOADING FUNCTIONS =====
async function loadAllData() {
    try {
        console.log('Loading all data...');
        
        // Load data berdasarkan tab aktif
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            
            if (tabId === 'summary-tab') {
                await loadSummaryData();
            } else if (tabId === 'projects-tab') {
                await loadProjects();
            } else if (tabId === 'non-projects-tab') {
                await loadNonProjects();
            } else if (tabId === 'manpower-tab') {
                await loadManPower();
            }
        }
        
        console.log('All data refreshed at:', new Date().toLocaleTimeString());
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Gagal memuat data. Silakan refresh halaman.', 'danger');
    }
}

async function loadSummaryData() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/summary`);
        const data = response.data;
        
        // Update summary cards
        updateElementText('total-projects', data.total_projects || 0);
        updateElementText('total-non-projects', data.total_non_projects || 0);
        updateElementText('total-budget', formatCurrency(data.total_budget || 0));
        updateElementText('total-actual', formatCurrency(data.total_actual || 0));
        
        // Update priority projects table
        updatePriorityProjectsTable(data.priority_projects || []);
        
        // Update map with project locations
        updateMap(data.locations || []);
        
        // Update charts
        updateOverallSCurveChart(data.overall_s_curve || {labels: [], planned: [], actual: []});
        updateStatusDistributionChart(data.status_distribution || {});
        
        // Update priority tasks
        updatePriorityTasksTable(data.priority_tasks || []);
        
    } catch (error) {
        console.error('Error loading summary data:', error);
        showAlert('Gagal memuat data summary', 'danger');
    }
}

// ===== TABLE UPDATE FUNCTIONS =====
function updatePriorityProjectsTable(projects) {
    const tableBody = document.getElementById('priority-projects');
    if (!tableBody) return;
    
    if (projects.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Tidak ada proyek prioritas</td></tr>';
        return;
    }
    
    let html = '';
    projects.forEach(project => {
        const statusClass = project.status ? project.status.toLowerCase().replace(' ', '-') : 'not-started';
        html += `
            <tr class="slide-in">
                <td><strong class="text-primary">${project.name || '-'}</strong></td>
                <td>${formatDate(project.end_date)}</td>
                <td><span class="status-badge status-${statusClass}">
                    ${project.status || 'Not Started'}
                </span></td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function updateMap(locations) {
    if (!map || !locations) return;
    
    try {
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
        
        // Add new markers
        const markers = [];
        locations.forEach(location => {
            if (location.lat && location.lng) {
                const marker = L.marker([location.lat, location.lng])
                    .addTo(map)
                    .bindPopup(`
                        <div style="min-width: 200px;">
                            <h6 style="margin: 0 0 5px 0; color: #006400;"><strong>${location.name || '-'}</strong></h6>
                            <p style="margin: 0 0 5px 0; font-size: 12px;">
                                <i class="fas fa-map-marker-alt"></i> ${location.location || '-'}
                            </p>
                            <p style="margin: 0 0 5px 0; font-size: 12px;">
                                Status: <span class="status-badge status-${location.status ? location.status.toLowerCase().replace(' ', '-') : 'not-started'}">
                                    ${location.status || 'Not Started'}
                                </span>
                            </p>
                            <p style="margin: 0; font-size: 12px;">
                                Prioritas: <span class="priority-badge priority-${location.priority ? location.priority.toLowerCase() : 'medium'}">
                                    ${location.priority || 'Medium'}
                                </span>
                            </p>
                        </div>
                    `);
                markers.push(marker);
            }
        });
        
        // Fit bounds if there are markers
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }
    } catch (error) {
        console.error('Error updating map:', error);
    }
}

// ===== CHART FUNCTIONS =====
function updateOverallSCurveChart(sCurveData) {
    const ctx = document.getElementById('overall-s-curve-chart');
    if (!ctx) return;
    
    try {
        // Destroy existing chart
        if (charts.overallSCurve) {
            charts.overallSCurve.destroy();
        }
        
        const labels = sCurveData.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const planned = sCurveData.planned || Array(12).fill(0);
        const actual = sCurveData.actual || Array(12).fill(0);
        
        charts.overallSCurve = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned',
                        data: planned,
                        borderColor: '#006400',
                        backgroundColor: 'rgba(0, 100, 0, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3
                    },
                    {
                        label: 'Actual',
                        data: actual,
                        borderColor: '#D32F2F',
                        backgroundColor: 'rgba(211, 47, 47, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Progress (%)',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Bulan',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating overall S-curve chart:', error);
    }
}

function updateStatusDistributionChart(statusData) {
    const ctx = document.getElementById('status-distribution-chart');
    if (!ctx) return;
    
    try {
        // Destroy existing chart
        if (charts.statusDistribution) {
            charts.statusDistribution.destroy();
        }
        
        const labels = Object.keys(statusData);
        const data = Object.values(statusData);
        const colors = {
            'Not Started': '#e9ecef',
            'In Progress': '#fff3cd',
            'On Track': '#d4edda',
            'Delayed': '#f8d7da',
            'Completed': '#d1ecf1'
        };
        
        charts.statusDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: labels.map(label => colors[label] || '#6c757d'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 11
                            },
                            padding: 15
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating status distribution chart:', error);
    }
}

function updatePriorityTasksTable(tasks) {
    const tableBody = document.getElementById('priority-tasks');
    if (!tableBody) return;
    
    if (!tasks || tasks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada task prioritas</td></tr>';
        return;
    }
    
    let html = '';
    tasks.forEach(task => {
        const projectName = getProjectName(task.project_id);
        const statusClass = task.status ? task.status.toLowerCase().replace(' ', '-') : 'not-started';
        const progress = task.progress || 0;
        
        html += `
            <tr class="slide-in">
                <td><small class="text-primary">${projectName || '-'}</small></td>
                <td><strong>${task.name || '-'}</strong></td>
                <td>${task.pic || '-'}</td>
                <td>${formatDate(task.due_date)}</td>
                <td><span class="status-badge status-${statusClass}">
                    ${task.status || 'Not Started'}
                </span></td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 6px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <small>${progress}%</small>
                    </div>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

// ===== PROJECT FUNCTIONS =====
async function loadProjects() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/projects`);
        projectsData = response.data || [];
        
        // Update projects table
        updateProjectsTable(projectsData);
        
        // Update project select dropdown
        updateProjectSelect(projectsData);
        
        // Update project select in assignment modal
        updateProjectSelectForAssignment(projectsData);
        
    } catch (error) {
        console.error('Error loading projects:', error);
        showAlert('Gagal memuat data proyek', 'danger');
    }
}

function updateProjectsTable(projects) {
    const tableBody = document.getElementById('projects-table');
    if (!tableBody) return;
    
    if (projects.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada proyek</td></tr>';
        return;
    }
    
    let html = '';
    projects.forEach(project => {
        const statusClass = project.status ? project.status.toLowerCase().replace(' ', '-') : 'not-started';
        const priorityClass = project.priority ? project.priority.toLowerCase() : 'medium';
        const progress = project.progress || 0;
        
        html += `
            <tr class="slide-in">
                <td>
                    <div class="fw-bold text-primary">${project.name || '-'}</div>
                    ${project.location ? `<div class="text-muted small"><i class="fas fa-map-marker-alt"></i> ${project.location}</div>` : ''}
                </td>
                <td><span class="status-badge status-${statusClass}">
                    ${project.status || 'Not Started'}
                </span></td>
                <td><span class="priority-badge priority-${priorityClass}">
                    ${project.priority || 'Medium'}
                </span></td>
                <td>
                    <div class="small">${formatDate(project.start_date)}</div>
                    <div class="small text-muted">s/d ${formatDate(project.end_date)}</div>
                </td>
                <td class="fw-bold">${formatCurrency(project.budget || 0)}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 6px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <span class="small">${progress}%</span>
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editProject(${project.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteProject(${project.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function updateProjectSelect(projects) {
    const select = document.getElementById('project-select');
    if (!select) return;
    
    const currentValue = select.value;
    let html = '<option value="">Pilih Proyek...</option>';
    
    projects.forEach(project => {
        html += `<option value="${project.id}">${project.name || '-'}</option>`;
    });
    
    select.innerHTML = html;
    
    // Restore previous selection
    if (currentValue) {
        select.value = currentValue;
        loadProjectDetails();
    }
}

function updateProjectSelectForAssignment(projects) {
    const select = document.getElementById('projectSelectAssignment');
    if (!select) return;
    
    let html = '<option value="">-- Pilih Proyek --</option>';
    
    projects.forEach(project => {
        html += `<option value="${project.id}">${project.name || '-'}</option>`;
    });
    
    select.innerHTML = html;
}

async function loadProjectDetails() {
    const projectId = document.getElementById('project-select')?.value;
    if (!projectId) {
        const detailsSection = document.getElementById('project-details-section');
        if (detailsSection) detailsSection.style.display = 'none';
        return;
    }
    
    try {
        currentProjectId = projectId;
        const detailsSection = document.getElementById('project-details-section');
        if (detailsSection) detailsSection.style.display = 'block';
        
        // Load project details
        const [projectResponse, sCurveResponse, tasksResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/projects/${projectId}`),
            axios.get(`${API_BASE_URL}/api/projects/${projectId}/s-curve`),
            axios.get(`${API_BASE_URL}/api/projects/${projectId}/tasks`)
        ]);
        
        const project = projectResponse.data;
        const sCurveData = sCurveResponse.data;
        const tasks = tasksResponse.data || [];
        
        // Update UI
        updateProjectInfo(project);
        updateProjectSCurveChart(sCurveData);
        updateProjectDeviationChart(project);
        updateProjectTasksTable(tasks);
        
    } catch (error) {
        console.error('Error loading project details:', error);
        showAlert('Gagal memuat detail proyek', 'danger');
    }
}

function updateProjectInfo(project) {
    const container = document.getElementById('project-info-details');
    if (!container) return;
    
    const variance = (project.budget || 0) - (project.actual_cost || 0);
    const varianceClass = variance >= 0 ? 'text-success' : 'text-danger';
    const varianceIcon = variance >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    const progress = project.progress || 0;
    
    const html = `
        <div class="mb-3">
            <h6 class="text-muted mb-2">Deskripsi</h6>
            <p class="small">${project.description || '-'}</p>
        </div>
        <div class="mb-3">
            <h6 class="text-muted mb-2">Lokasi</h6>
            <p class="small"><i class="fas fa-map-marker-alt"></i> ${project.location || '-'}</p>
        </div>
        <div class="mb-3">
            <h6 class="text-muted mb-2">Tanggal</h6>
            <p class="small mb-1">Start: ${formatDate(project.start_date)}</p>
            <p class="small">End: ${formatDate(project.end_date)}</p>
        </div>
        <div class="mb-3">
            <h6 class="text-muted mb-2">Finansial</h6>
            <p class="small mb-1">Budget: ${formatCurrency(project.budget || 0)}</p>
            <p class="small mb-1">Actual: ${formatCurrency(project.actual_cost || 0)}</p>
            <p class="small ${varianceClass}">
                <i class="fas ${varianceIcon}"></i> Variance: ${formatCurrency(Math.abs(variance))}
            </p>
        </div>
        <div class="mb-3">
            <h6 class="text-muted mb-2">Progress</h6>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="d-flex justify-content-between mt-1">
                <small class="text-muted">0%</small>
                <small class="fw-bold">${progress}%</small>
                <small class="text-muted">100%</small>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function updateProjectSCurveChart(sCurveData) {
    const ctx = document.getElementById('project-s-curve-chart');
    if (!ctx) return;
    
    try {
        if (charts.projectSCurve) {
            charts.projectSCurve.destroy();
        }
        
        const labels = sCurveData.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const planned = sCurveData.planned || Array(12).fill(0);
        const actual = sCurveData.actual || Array(12).fill(0);
        
        charts.projectSCurve = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned',
                        data: planned,
                        borderColor: '#006400',
                        backgroundColor: 'rgba(0, 100, 0, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3
                    },
                    {
                        label: 'Actual',
                        data: actual,
                        borderColor: '#D32F2F',
                        backgroundColor: 'rgba(211, 47, 47, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating project S-curve chart:', error);
    }
}

function updateProjectDeviationChart(project) {
    const ctx = document.getElementById('project-deviation-chart');
    if (!ctx) return;
    
    try {
        if (charts.projectDeviation) {
            charts.projectDeviation.destroy();
        }
        
        const budget = project.budget || 0;
        const actualCost = project.actual_cost || 0;
        
        charts.projectDeviation = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Budget', 'Actual Cost'],
                datasets: [{
                    data: [budget, actualCost],
                    backgroundColor: ['#006400', '#D32F2F'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrencyShort(value);
                            },
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating project deviation chart:', error);
    }
}

function updateProjectTasksTable(tasks) {
    const tableBody = document.getElementById('project-tasks-table');
    if (!tableBody) return;
    
    if (tasks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada task</td></tr>';
        return;
    }
    
    let html = '';
    tasks.forEach(task => {
        const statusClass = task.status ? task.status.toLowerCase().replace(' ', '-') : 'not-started';
        
        html += `
            <tr>
                <td>
                    <div class="fw-bold">${task.name || '-'}</div>
                    ${task.description ? `<div class="text-muted small">${task.description}</div>` : ''}
                </td>
                <td>${task.pic || '-'}</td>
                <td>${formatDate(task.due_date)}</td>
                <td class="small">${task.action_plan || '-'}</td>
                <td><span class="status-badge status-${statusClass}">
                    ${task.status || 'Not Started'}
                </span></td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteTask(${task.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

// ===== NON-PROJECT FUNCTIONS =====
async function loadNonProjects() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/non-projects`);
        const nonProjects = response.data || [];
        
        updateNonProjectsTable(nonProjects);
        updateNonProjectSelectForAssignment(nonProjects);
        
    } catch (error) {
        console.error('Error loading non-projects:', error);
        showAlert('Gagal memuat data non-proyek', 'danger');
    }
}

function updateNonProjectsTable(nonProjects) {
    const tableBody = document.getElementById('non-projects-table');
    if (!tableBody) return;
    
    if (nonProjects.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-inbox fa-2x mb-3"></i>
                        <div>Belum ada non-proyek</div>
                        <small>Klik "Tambah" untuk menambahkan non-proyek baru</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    nonProjects.forEach(np => {
        const statusClass = np.status ? np.status.toLowerCase().replace(' ', '-') : 'not-started';
        const progress = np.progress || 0;
        const categoryColor = getCategoryColor(np.category);
        
        html += `
            <tr class="slide-in">
                <td>
                    <div class="fw-bold text-primary">${np.name || '-'}</div>
                    ${np.description ? `<div class="text-muted small mt-1">${np.description}</div>` : ''}
                </td>
                <td>
                    <span class="badge" style="background: ${categoryColor}; color: white;">
                        ${np.category || 'Lainnya'}
                    </span>
                </td>
                <td><span class="status-badge status-${statusClass}">
                    ${np.status || 'Not Started'}
                </span></td>
                <td>
                    <div class="small">${formatDate(np.start_date)}</div>
                    <div class="small text-muted">s/d ${formatDate(np.end_date)}</div>
                </td>
                <td class="fw-bold text-success">${formatCurrency(np.budget || 0)}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 8px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <span class="small fw-bold">${progress}%</span>
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="showEditNonProjectModal(${np.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteNonProject(${np.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function updateNonProjectSelectForAssignment(nonProjects) {
    const select = document.getElementById('nonProjectSelectAssignment');
    if (!select) return;
    
    let html = '<option value="">-- Pilih Non-Proyek --</option>';
    
    nonProjects.forEach(np => {
        html += `<option value="${np.id}">${np.name || '-'}</option>`;
    });
    
    select.innerHTML = html;
}

// ===== MANPOWER FUNCTIONS =====
async function loadManPower() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/manpower`);
        manpowerData = response.data || [];
        
        updateManPowerTable(manpowerData);
        updateManPowerSelect(manpowerData);
        loadTeamWorkloadChart(manpowerData);
        
    } catch (error) {
        console.error('Error loading manpower:', error);
        showAlert('Gagal memuat data manpower', 'danger');
    }
}

function updateManPowerTable(manpower) {
    const tableBody = document.getElementById('manpower-table');
    if (!tableBody) return;
    
    if (manpower.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada manpower</td></tr>';
        return;
    }
    
    let html = '';
    manpower.forEach(person => {
        const availability = person.availability || 0;
        let progressBarClass = 'bg-danger';
        if (availability > 80) progressBarClass = 'bg-success';
        else if (availability > 50) progressBarClass = 'bg-warning';
        
        html += `
            <tr class="slide-in">
                <td>
                    <div class="fw-bold text-primary">${person.name || '-'}</div>
                    ${person.email ? `<div class="text-muted small">${person.email}</div>` : ''}
                </td>
                <td>${person.position || '-'}</td>
                <td>${person.department || '-'}</td>
                <td class="small">${person.skills || '-'}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 6px;">
                            <div class="progress-bar ${progressBarClass}" style="width: ${availability}%"></div>
                        </div>
                        <span class="small">${availability}%</span>
                    </div>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editManPower(${person.id})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteManPower(${person.id})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

function updateManPowerSelect(manpower) {
    const select = document.getElementById('manpower-select');
    if (!select) return;
    
    const currentValue = select.value;
    let html = '<option value="">Pilih Man Power...</option>';
    
    manpower.forEach(person => {
        html += `<option value="${person.id}">${person.name || '-'} - ${person.position || '-'}</option>`;
    });
    
    select.innerHTML = html;
    
    if (currentValue) {
        select.value = currentValue;
        loadManPowerDetails();
    }
}

async function loadManPowerDetails() {
    const manpowerId = document.getElementById('manpower-select')?.value;
    if (!manpowerId) {
        const detailsSection = document.getElementById('manpower-details-section');
        if (detailsSection) detailsSection.style.display = 'none';
        return;
    }
    
    try {
        currentManPowerId = manpowerId;
        const detailsSection = document.getElementById('manpower-details-section');
        if (detailsSection) detailsSection.style.display = 'block';
        
        const assignmentsResponse = await axios.get(`${API_BASE_URL}/api/manpower/${manpowerId}/assignments`);
        const assignments = assignmentsResponse.data || [];
        
        updateManPowerDistributionChart(assignments);
        updateManPowerAssignmentsTable(assignments);
        
    } catch (error) {
        console.error('Error loading manpower details:', error);
        showAlert('Gagal memuat detail manpower', 'danger');
    }
}

function updateManPowerDistributionChart(assignments) {
    const ctx = document.getElementById('manpower-project-distribution-chart');
    if (!ctx) return;
    
    try {
        if (charts.manpowerDistribution) {
            charts.manpowerDistribution.destroy();
        }
        
        // Group assignments
        const projectData = {};
        assignments.forEach(assignment => {
            let projectName = 'Unknown';
            if (assignment.project_id) {
                projectName = `Proyek ${getProjectName(assignment.project_id)}`;
            } else if (assignment.non_project_id) {
                projectName = `Non-Proyek ${assignment.non_project_id}`;
            }
            
            if (!projectData[projectName]) {
                projectData[projectName] = 0;
            }
            projectData[projectName] += assignment.hours_per_week || 0;
        });
        
        const labels = Object.keys(projectData);
        const data = Object.values(projectData);
        
        if (labels.length === 0) {
            ctx.parentElement.innerHTML = '<p class="text-muted text-center py-4">Tidak ada assignment</p>';
            return;
        }
        
        charts.manpowerDistribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#006400', '#28a745', '#ffc107', '#D32F2F',
                        '#1E88E5', '#20c997', '#fd7e14', '#e83e8c'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 11
                            },
                            padding: 15
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating manpower distribution chart:', error);
    }
}

function updateManPowerAssignmentsTable(assignments) {
    const tableBody = document.getElementById('manpower-assignments-table');
    if (!tableBody) return;
    
    if (assignments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada assignment</td></tr>';
        return;
    }
    
    let html = '';
    assignments.forEach(assignment => {
        let projectName = '-';
        if (assignment.project_id) {
            projectName = `Proyek ${getProjectName(assignment.project_id)}`;
        } else if (assignment.non_project_id) {
            projectName = `Non-Proyek ${assignment.non_project_id}`;
        }
        
        const status = assignment.status || 'Active';
        const statusClass = status === 'Active' ? 'success' : 'secondary';
        
        html += `
            <tr>
                <td>${projectName}</td>
                <td>${assignment.role || '-'}</td>
                <td>${assignment.hours_per_week || 0} jam/minggu</td>
                <td><span class="badge bg-${statusClass}">${status}</span></td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteAssignment(${assignment.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
}

// ===== TEAM WORKLOAD CHART =====
async function loadTeamWorkloadChart(manpower) {
    const canvas = document.getElementById('team-workload-chart');
    if (!canvas) return;
    
    try {
        const container = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        
        // Get assignments for each person
        const workloadData = [];
        
        for (const person of manpower) {
            try {
                const assignmentsResponse = await axios.get(`${API_BASE_URL}/api/manpower/${person.id}/assignments`);
                const assignments = assignmentsResponse.data || [];
                const totalHours = assignments.reduce((sum, assignment) => sum + (assignment.hours_per_week || 0), 0);
                const totalAvailable = person.total_hours || 40;
                const utilization = totalAvailable > 0 ? Math.min(100, (totalHours / totalAvailable) * 100) : 0;
                
                workloadData.push({
                    name: person.name || 'Unknown',
                    totalHours: totalAvailable,
                    assignedHours: totalHours,
                    utilization: utilization
                });
            } catch (error) {
                console.error(`Error loading assignments for person ${person.id}:`, error);
                workloadData.push({
                    name: person.name || 'Unknown',
                    totalHours: person.total_hours || 40,
                    assignedHours: 0,
                    utilization: 0
                });
            }
        }
        
        // Destroy existing chart
        if (charts.teamWorkload instanceof Chart) {
            charts.teamWorkload.destroy();
        }
        
        // Create chart
        charts.teamWorkload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: workloadData.map(d => d.name.substring(0, 15) + (d.name.length > 15 ? '...' : '')),
                datasets: [
                    {
                        label: 'Total Hours Available',
                        data: workloadData.map(d => d.totalHours),
                        backgroundColor: 'rgba(0, 100, 0, 0.7)',
                        borderColor: '#006400',
                        borderWidth: 1,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: 'Assigned Hours',
                        data: workloadData.map(d => d.assignedHours),
                        backgroundColor: workloadData.map(d => 
                            d.utilization > 100 ? 'rgba(211, 47, 47, 0.8)' :
                            d.utilization > 80 ? 'rgba(255, 193, 7, 0.8)' :
                            'rgba(40, 167, 69, 0.8)'
                        ),
                        borderColor: workloadData.map(d => 
                            d.utilization > 100 ? '#D32F2F' :
                            d.utilization > 80 ? '#ffc107' :
                            '#28a745'
                        ),
                        borderWidth: 1,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jam per Minggu',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            stepSize: 10
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: {
                            size: 12
                        },
                        bodyFont: {
                            size: 11
                        },
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.parsed.y + ' jam';
                                
                                if (context.datasetIndex === 1) {
                                    const personIndex = context.dataIndex;
                                    const utilization = workloadData[personIndex].utilization;
                                    label += ` (${utilization.toFixed(1)}% utilization)`;
                                }
                                
                                return label;
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading team workload chart:', error);
        const container = canvas.parentElement;
        container.innerHTML = `
            <div class="text-center text-danger py-5">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <div>Gagal memuat chart</div>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// ===== MODAL SHOW FUNCTIONS =====
function showAddProjectModal() {
    const modalElement = document.getElementById('addProjectModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function showAddTaskModal() {
    if (!currentProjectId) {
        showAlert('Silakan pilih proyek terlebih dahulu', 'warning');
        return;
    }
    
    const projectIdInput = document.getElementById('taskProjectId');
    if (projectIdInput) {
        projectIdInput.value = currentProjectId;
    }
    
    const modalElement = document.getElementById('addTaskModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function showAddManPowerModal() {
    const modalElement = document.getElementById('addManPowerModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function showAddNonProjectModal() {
    const modalElement = document.getElementById('addNonProjectModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function showAddAssignmentModal() {
    if (!currentManPowerId) {
        showAlert('Silakan pilih man power terlebih dahulu', 'warning');
        return;
    }
    
    const manpowerIdInput = document.getElementById('assignmentManPowerId');
    if (manpowerIdInput) {
        manpowerIdInput.value = currentManPowerId;
    }
    
    const modalElement = document.getElementById('addAssignmentModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function showEditNonProjectModal(id) {
    axios.get(`${API_BASE_URL}/api/non-projects/${id}`)
        .then(response => {
            const np = response.data;
            const form = document.getElementById('nonProjectForm');
            
            if (form) {
                Object.keys(np).forEach(key => {
                    if (form.elements[key]) {
                        form.elements[key].value = np[key] || '';
                    }
                });
                
                const modalElement = document.getElementById('addNonProjectModal');
                if (modalElement) {
                    const modal = new bootstrap.Modal(modalElement);
                    const saveBtn = modalElement.querySelector('.btn-primary');
                    if (saveBtn) {
                        saveBtn.textContent = 'Update';
                        saveBtn.onclick = function() { updateNonProject(id); };
                    }
                    modal.show();
                }
            }
        })
        .catch(error => {
            console.error('Error loading non-project:', error);
            showAlert('Gagal memuat data non-proyek', 'danger');
        });
}

// ===== CRUD OPERATIONS =====
async function addProject() {
    try {
        const form = document.getElementById('projectForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.budget = parseFloat(data.budget) || 0;
        data.actual_cost = parseFloat(data.actual_cost) || 0;
        data.progress = parseFloat(data.progress) || 0;
        data.latitude = data.latitude ? parseFloat(data.latitude) : null;
        data.longitude = data.longitude ? parseFloat(data.longitude) : null;
        
        const response = await axios.post(`${API_BASE_URL}/api/projects`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProjectModal'));
        if (modal) modal.hide();
        form.reset();
        
        showAlert('Proyek berhasil ditambahkan!', 'success');
        loadAllData();
        
    } catch (error) {
        console.error('Error adding project:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Gagal menambahkan proyek';
        showAlert(errorMsg, 'danger');
    }
}

async function addNonProject() {
    try {
        const form = document.getElementById('nonProjectForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.budget = parseFloat(data.budget) || 0;
        data.actual_cost = parseFloat(data.actual_cost) || 0;
        data.progress = parseFloat(data.progress) || 0;
        
        const response = await axios.post(`${API_BASE_URL}/api/non-projects`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addNonProjectModal'));
        if (modal) modal.hide();
        form.reset();
        
        showAlert('Non-proyek berhasil ditambahkan!', 'success');
        loadNonProjects();
        
    } catch (error) {
        console.error('Error adding non-project:', error);
        const errorMsg = error.response?.data?.error || error.message || 'Gagal menambahkan non-proyek';
        showAlert(errorMsg, 'danger');
    }
}

async function updateNonProject(id) {
    try {
        const form = document.getElementById('nonProjectForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.budget = parseFloat(data.budget) || 0;
        data.actual_cost = parseFloat(data.actual_cost) || 0;
        data.progress = parseFloat(data.progress) || 0;
        
        const response = await axios.put(`${API_BASE_URL}/api/non-projects/${id}`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addNonProjectModal'));
        if (modal) modal.hide();
        form.reset();
        
        // Reset button text
        const saveBtn = document.querySelector('#addNonProjectModal .btn-primary');
        if (saveBtn) {
            saveBtn.textContent = 'Simpan';
            saveBtn.onclick = function() { addNonProject(); };
        }
        
        showAlert('Non-proyek berhasil diupdate!', 'success');
        loadNonProjects();
        
    } catch (error) {
        console.error('Error updating non-project:', error);
        showAlert('Gagal mengupdate non-proyek', 'danger');
    }
}

async function addTask() {
    try {
        const form = document.getElementById('taskForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        data.project_id = parseInt(data.project_id) || currentProjectId;
        data.progress = 0; // Default progress
        
        const response = await axios.post(`${API_BASE_URL}/api/tasks`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addTaskModal'));
        if (modal) modal.hide();
        form.reset();
        
        showAlert('Task berhasil ditambahkan!', 'success');
        loadProjectDetails();
        
    } catch (error) {
        console.error('Error adding task:', error);
        showAlert('Gagal menambahkan task', 'danger');
    }
}

async function addManPower() {
    try {
        const form = document.getElementById('manPowerForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.total_hours = parseInt(data.total_hours) || 40;
        data.availability = parseFloat(data.availability) || 100;
        
        const response = await axios.post(`${API_BASE_URL}/api/manpower`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addManPowerModal'));
        if (modal) modal.hide();
        form.reset();
        
        showAlert('Man Power berhasil ditambahkan!', 'success');
        loadManPower();
        
    } catch (error) {
        console.error('Error adding manpower:', error);
        showAlert('Gagal menambahkan man power', 'danger');
    }
}

async function addAssignment() {
    try {
        const form = document.getElementById('assignmentForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Process based on target type
        if (data.target_type === 'project') {
            data.project_id = parseInt(data.project_id);
            data.non_project_id = null;
        } else if (data.target_type === 'non_project') {
            data.non_project_id = parseInt(data.non_project_id);
            data.project_id = null;
        }
        
        // Remove target_type from data
        delete data.target_type;
        
        // Convert numeric fields
        data.hours_per_week = parseInt(data.hours_per_week) || 0;
        data.manpower_id = parseInt(data.manpower_id) || currentManPowerId;
        
        const response = await axios.post(`${API_BASE_URL}/api/assignments`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addAssignmentModal'));
        if (modal) modal.hide();
        form.reset();
        
        // Reset form visibility
        const projectDiv = document.getElementById('projectSelection');
        const nonProjectDiv = document.getElementById('nonProjectSelection');
        if (projectDiv) projectDiv.style.display = 'none';
        if (nonProjectDiv) nonProjectDiv.style.display = 'none';
        
        showAlert('Assignment berhasil ditambahkan!', 'success');
        loadManPowerDetails();
        
    } catch (error) {
        console.error('Error adding assignment:', error);
        showAlert('Gagal menambahkan assignment', 'danger');
    }
}

// ===== DELETE FUNCTIONS =====
async function deleteProject(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus proyek ini?')) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/api/projects/${id}`);
        showAlert('Proyek berhasil dihapus!', 'success');
        loadAllData();
    } catch (error) {
        console.error('Error deleting project:', error);
        showAlert('Gagal menghapus proyek', 'danger');
    }
}

async function deleteTask(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus task ini?')) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/api/tasks/${id}`);
        showAlert('Task berhasil dihapus!', 'success');
        loadProjectDetails();
    } catch (error) {
        console.error('Error deleting task:', error);
        showAlert('Gagal menghapus task', 'danger');
    }
}

async function deleteManPower(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus man power ini?')) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/api/manpower/${id}`);
        showAlert('Man Power berhasil dihapus!', 'success');
        loadManPower();
    } catch (error) {
        console.error('Error deleting manpower:', error);
        showAlert('Gagal menghapus man power', 'danger');
    }
}

async function deleteNonProject(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus non-proyek ini?')) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/api/non-projects/${id}`);
        showAlert('Non-proyek berhasil dihapus!', 'success');
        loadNonProjects();
    } catch (error) {
        console.error('Error deleting non-project:', error);
        showAlert('Gagal menghapus non-proyek', 'danger');
    }
}

async function deleteAssignment(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus assignment ini?')) return;
    
    try {
        await axios.delete(`${API_BASE_URL}/api/assignments/${id}`);
        showAlert('Assignment berhasil dihapus!', 'success');
        loadManPowerDetails();
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showAlert('Gagal menghapus assignment', 'danger');
    }
}

// ===== EDIT FUNCTIONS =====
async function editProject(id) {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/projects/${id}`);
        const project = response.data;
        
        const form = document.getElementById('projectForm');
        if (form) {
            Object.keys(project).forEach(key => {
                if (form.elements[key]) {
                    const element = form.elements[key];
                    if (element.type === 'date') {
                        // Format date for input type="date"
                        if (project[key]) {
                            const date = new Date(project[key]);
                            element.value = date.toISOString().split('T')[0];
                        }
                    } else {
                        element.value = project[key] || '';
                    }
                }
            });
            
            const modalElement = document.getElementById('addProjectModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                const saveBtn = modalElement.querySelector('.btn-primary');
                if (saveBtn) {
                    saveBtn.textContent = 'Update';
                    saveBtn.onclick = function() { updateProject(id); };
                }
                modal.show();
            }
        }
    } catch (error) {
        console.error('Error loading project for edit:', error);
        showAlert('Gagal memuat data proyek', 'danger');
    }
}

async function updateProject(id) {
    try {
        const form = document.getElementById('projectForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.budget = parseFloat(data.budget) || 0;
        data.actual_cost = parseFloat(data.actual_cost) || 0;
        data.progress = parseFloat(data.progress) || 0;
        data.latitude = data.latitude ? parseFloat(data.latitude) : null;
        data.longitude = data.longitude ? parseFloat(data.longitude) : null;
        
        const response = await axios.put(`${API_BASE_URL}/api/projects/${id}`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addProjectModal'));
        if (modal) modal.hide();
        form.reset();
        
        // Reset button text
        const saveBtn = document.querySelector('#addProjectModal .btn-primary');
        if (saveBtn) {
            saveBtn.textContent = 'Simpan';
            saveBtn.onclick = function() { addProject(); };
        }
        
        showAlert('Proyek berhasil diupdate!', 'success');
        loadAllData();
        
    } catch (error) {
        console.error('Error updating project:', error);
        showAlert('Gagal mengupdate proyek', 'danger');
    }
}

async function editManPower(id) {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/manpower/${id}`);
        const person = response.data;
        
        const form = document.getElementById('manPowerForm');
        if (form) {
            Object.keys(person).forEach(key => {
                if (form.elements[key]) {
                    form.elements[key].value = person[key] || '';
                }
            });
            
            const modalElement = document.getElementById('addManPowerModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                const saveBtn = modalElement.querySelector('.btn-primary');
                if (saveBtn) {
                    saveBtn.textContent = 'Update';
                    saveBtn.onclick = function() { updateManPower(id); };
                }
                modal.show();
            }
        }
    } catch (error) {
        console.error('Error loading manpower for edit:', error);
        showAlert('Gagal memuat data man power', 'danger');
    }
}

async function updateManPower(id) {
    try {
        const form = document.getElementById('manPowerForm');
        if (!form) {
            showAlert('Form tidak ditemukan', 'danger');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert numeric fields
        data.total_hours = parseInt(data.total_hours) || 40;
        data.availability = parseFloat(data.availability) || 100;
        
        const response = await axios.put(`${API_BASE_URL}/api/manpower/${id}`, data);
        
        // Close modal and refresh data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addManPowerModal'));
        if (modal) modal.hide();
        form.reset();
        
        // Reset button text
        const saveBtn = document.querySelector('#addManPowerModal .btn-primary');
        if (saveBtn) {
            saveBtn.textContent = 'Simpan';
            saveBtn.onclick = function() { addManPower(); };
        }
        
        showAlert('Man Power berhasil diupdate!', 'success');
        loadManPower();
        
    } catch (error) {
        console.error('Error updating manpower:', error);
        showAlert('Gagal mengupdate man power', 'danger');
    }
}

// ===== UTILITY FUNCTIONS =====
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function getProjectName(projectId) {
    if (!projectId) return null;
    const project = projectsData.find(p => p.id == projectId);
    return project ? project.name : null;
}

function formatCurrency(amount) {
    if (!amount && amount !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatCurrencyShort(amount) {
    if (!amount && amount !== 0) return 'Rp 0';
    if (amount >= 1000000000) {
        return 'Rp' + (amount / 1000000000).toFixed(1) + 'M';
    } else if (amount >= 1000000) {
        return 'Rp' + (amount / 1000000).toFixed(1) + 'Jt';
    } else if (amount >= 1000) {
        return 'Rp' + (amount / 1000).toFixed(1) + 'K';
    }
    return 'Rp' + amount;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function getCategoryColor(category) {
    const colors = {
        'Internal': '#0066CC',
        'Meeting': '#009933',
        'Training': '#FFCC00',
        'Maintenance': '#CC0000',
        'Lainnya': '#6c757d'
    };
    return colors[category] || '#6c757d';
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.alert.position-fixed').forEach(alert => {
        alert.remove();
    });
    
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to body
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// ===== RESIZE HANDLER =====
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        // Redraw semua chart dengan dimensi baru
        Object.values(charts).forEach(chart => {
            if (chart instanceof Chart) {
                try {
                    chart.resize();
                    chart.update('none');
                } catch (error) {
                    console.error('Error resizing chart:', error);
                }
            }
        });
    }, 250);
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Initialize dengan resize setelah load
setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
}, 100);
