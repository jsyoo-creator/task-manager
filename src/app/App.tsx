import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Layout from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import TaskManagement from '../pages/TaskManagement';
import CalendarPage from '../pages/CalendarPage';
import WeeklyPage from '../pages/WeeklyPage';
import VacationPage from '../pages/VacationPage';
import SeatMapPage from '../pages/SeatMapPage';
import { useProjects } from '../hooks/useProjects';
import { useTasks, useAllSubTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import type { TaskCategory } from '../types';

function App() {
  const { projects, loading: projLoading, addProject } = useProjects();
  const [projectId, setProjectId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'all'>('all');
  const { members } = useMembers();
  const { vacations, addVacation, deleteVacation } = useVacations();

  useEffect(() => {
    if (!projLoading && projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projLoading, projectId]);

  useEffect(() => {
    if (!projLoading && projects.length === 0) {
      addProject({
        name: '라이브 커머스 & 복지/사업자를 업무관리',
        description: '개인정보 보안 규정 위반 시 징계 대상이 될 수 있으니 보안 철저 (사무실 보안관리, 업무 관리 주의)',
        categories: ['라이브', '복지', '사업자'],
      });
    }
  }, [projLoading, projects.length]);

  const currentProject = projects.find(p => p.id === projectId) ?? null;
  const { tasks, addTask, updateTask, deleteTask } = useTasks(projectId);
  const { subtasks } = useAllSubTasks(projectId);

  if (projLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">로딩 중...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout
        project={currentProject}
        projects={projects}
        onProjectChange={setProjectId}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                tasks={tasks}
                subtasks={subtasks}
                project={currentProject}
              />
            }
          />
          <Route
            path="/tasks"
            element={
              <TaskManagement
                tasks={tasks}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                projectId={projectId}
                activeCategory={activeCategory}
              />
            }
          />
          <Route
            path="/calendar"
            element={<CalendarPage tasks={tasks} activeCategory={activeCategory} />}
          />
          <Route
            path="/weekly"
            element={
              <WeeklyPage
                tasks={tasks}
                subtasks={subtasks}
                members={members}
                activeCategory={activeCategory}
              />
            }
          />
          <Route
            path="/vacation"
            element={
              <VacationPage
                vacations={vacations}
                members={members}
                onAddVacation={addVacation}
                onDeleteVacation={deleteVacation}
              />
            }
          />
          <Route
            path="/seats"
            element={<SeatMapPage members={members} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
