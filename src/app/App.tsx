import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import Layout from '../components/Layout';
import LoadingScreen from '../components/LoadingScreen';
import LoginPage from '../pages/LoginPage';
import Dashboard from '../pages/Dashboard';
import TaskManagement from '../pages/TaskManagement';
import CalendarPage from '../pages/CalendarPage';
import WeeklyPage from '../pages/WeeklyPage';
import VacationPage from '../pages/VacationPage';
import SeatMapPage from '../pages/SeatMapPage';
import SettingsPage from '../pages/SettingsPage';
import { useProjects } from '../hooks/useProjects';
import { useTasks, useAllSubTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { getPermissions } from '../types';
import type { TaskCategory } from '../types';

function App() {
  const { user, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const { appUser, loading: roleLoading, updateDisplayName } = useUserRole(user);

  const { projects, loading: projLoading, addProject } = useProjects();
  const [projectId, setProjectId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'all'>('all');
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [loadingDone, setLoadingDone] = useState(false);

  const { members } = useMembers();
  const { vacations, addVacation, deleteVacation } = useVacations();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (!projLoading && projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projLoading, projectId]);

  useEffect(() => {
    if (!projLoading && projects.length === 0) {
      addProject({
        name: '라이브 커머스 & 복지/사업자를 업무관리',
        description: '개인정보 보안 규정 위반 시 징계 대상이 될 수 있으니 보안 철저',
        categories: ['라이브', '복지', '사업자'],
      });
    }
  }, [projLoading, projects.length]);

  const currentProject = projects.find(p => p.id === projectId) ?? null;
  const { tasks, addTask, updateTask, deleteTask } = useTasks(projectId);
  const { subtasks } = useAllSubTasks(projectId);

  if (authLoading || (user && roleLoading)) {
    return <LoadingScreen done={false} onFinished={() => {}} isDark={isDark} />;
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} error={authError} />;
  }

  const permissions = getPermissions(appUser?.role ?? 'user');

  return (
    <>
      {!loadingDone && (
        <LoadingScreen
          done={!projLoading}
          onFinished={() => setLoadingDone(true)}
          isDark={isDark}
        />
      )}

      <BrowserRouter>
        <Layout
          project={currentProject}
          projects={projects}
          onProjectChange={setProjectId}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          isDark={isDark}
          onToggleDark={() => setIsDark(d => !d)}
          user={user}
          appUser={appUser}
          onSignOut={signOut}
        >
          <Routes>
            <Route path="/" element={
              <Dashboard tasks={tasks} subtasks={subtasks} project={currentProject} />
            } />
            <Route path="/tasks" element={
              <TaskManagement
                tasks={tasks} onAddTask={addTask} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} projectId={projectId}
                activeCategory={activeCategory} onCategoryChange={setActiveCategory}
                canManage={permissions.canManageTasks}
              />
            } />
            <Route path="/calendar" element={
              <CalendarPage tasks={tasks} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
            } />
            <Route path="/weekly" element={
              <WeeklyPage tasks={tasks} subtasks={subtasks} members={members} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
            } />
            <Route path="/vacation" element={
              <VacationPage vacations={vacations} members={members} onAddVacation={addVacation} onDeleteVacation={deleteVacation} />
            } />
            <Route path="/seats" element={<SeatMapPage members={members} />} />
            <Route path="/settings" element={
              appUser
                ? <SettingsPage appUser={appUser} onUpdateName={updateDisplayName} />
                : <div className="flex items-center justify-center h-40 text-sm text-gray-400">로딩 중...</div>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  );
}

export default App;
