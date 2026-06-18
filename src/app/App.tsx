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
import { useUserRole, useAllUsers } from '../hooks/useUserRole';
import { useTeams } from '../hooks/useTeams';
import { getPermissions, resolveBuiltinFields } from '../types';
import type { TaskCategory, TeamFormConfig } from '../types';

function App() {
  const { user, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const { appUser, loading: roleLoading, updateDisplayName, updateDepartment, updateSelectedTeam } = useUserRole(user);
  const { users: allUsers } = useAllUsers();

  const { projects, loading: projLoading, addProject } = useProjects();
  const [projectId, setProjectId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'all'>('all');
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [loadingDone, setLoadingDone] = useState(false);

  const { members } = useMembers();
  const { vacations, addVacation, deleteVacation } = useVacations();
  const { teams, loading: teamsLoading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updatePartFormConfig, clearPartFormConfig } = useTeams();

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

  const selectedTeam = teams.find(t => t.id === appUser?.selectedTeamId) ?? null;
  const activeParts = selectedTeam?.parts ?? [];
  const teamAssignees = selectedTeam
    ? allUsers.filter(u => u.selectedTeamId === selectedTeam.id).map(u => u.displayName)
    : [];

  // 활성 카테고리에 해당하는 파트 (없으면 undefined → 팀 기본 설정 사용)
  const activePart = activeCategory !== 'all'
    ? activeParts.find(p => p.name === activeCategory)
    : undefined;
  const effectiveFormConfig = activePart?.formConfig ?? selectedTeam?.formConfig;

  // 업무 관리 페이지에서 컬럼 너비 조절 시 적절한 레벨에 저장
  const handleTaskUpdateConfig = (config: TeamFormConfig) => {
    if (!selectedTeam) return;
    if (activePart) {
      updatePartFormConfig(selectedTeam.id, activePart.id, config);
    } else {
      updateFormConfig(selectedTeam.id, config);
    }
  };

  // 선택된 팀의 파트와 일치하는 업무만 표시 (파트가 있을 때만 필터링)
  const filteredTasks = activeParts.length > 0
    ? tasks.filter(t => activeParts.some(p => p.name === t.category))
    : tasks;

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
          teams={teams}
          teamsLoading={teamsLoading}
        >
          <Routes>
            <Route path="/" element={
              <Dashboard tasks={filteredTasks} subtasks={subtasks} project={currentProject} parts={activeParts} assignees={teamAssignees} isDark={isDark} />
            } />
            <Route path="/tasks" element={
              <TaskManagement
                tasks={filteredTasks} onAddTask={addTask} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} projectId={projectId}
                activeCategory={activeCategory} onCategoryChange={setActiveCategory}
                canManage={permissions.canManageTasks}
                parts={activeParts}
                assignees={teamAssignees}
                formConfig={effectiveFormConfig}
                builtinFields={resolveBuiltinFields(effectiveFormConfig)}
                onUpdateConfig={permissions.canManageTasks ? handleTaskUpdateConfig : undefined}
              />
            } />
            <Route path="/calendar" element={
              <CalendarPage tasks={filteredTasks} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} />
            } />
            <Route path="/weekly" element={
              <WeeklyPage tasks={filteredTasks} subtasks={subtasks} members={members} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} />
            } />
            <Route path="/vacation" element={
              <VacationPage vacations={vacations} members={members} onAddVacation={addVacation} onDeleteVacation={deleteVacation} />
            } />
            <Route path="/seats" element={<SeatMapPage members={members} />} />
            <Route path="/settings" element={
              appUser
                ? <SettingsPage
                    appUser={appUser}
                    onUpdateName={updateDisplayName}
                    onUpdateDepartment={updateDepartment}
                    onUpdateSelectedTeam={(id: string | null) => updateSelectedTeam(id)}
                    teams={teams}
                    onCreateTeam={createTeam}
                    onUpdateTeam={updateTeam}
                    onSetParts={setParts}
                    onDeleteTeam={deleteTeam}
                    onUpdateFormConfig={updateFormConfig}
                    onUpdatePartFormConfig={updatePartFormConfig}
                    onClearPartFormConfig={clearPartFormConfig}
                  />
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
