import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Layout from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import TaskManagement from '../pages/TaskManagement';
import { useProjects } from '../hooks/useProjects';
import { useTasks, useAllSubTasks } from '../hooks/useTasks';

function App() {
  const { projects, loading: projLoading, addProject } = useProjects();
  const [projectId, setProjectId] = useState<string>('');

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
      <Layout project={currentProject} projects={projects} onProjectChange={setProjectId}>
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
              />
            }
          />
          <Route path="/calendar" element={<PlaceholderPage title="캘린더" />} />
          <Route path="/weekly" element={<PlaceholderPage title="위클리" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-100 shadow-sm">
      <p className="text-gray-400 text-sm">{title} 페이지 준비 중</p>
    </div>
  );
}

export default App;
