import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';

function RouteWatcher({ onRouteChange }: { onRouteChange: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => { onRouteChange(location.pathname); }, [location.pathname]);
  return null;
}
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
import { useTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import { useAuth } from '../hooks/useAuth';
import { useUserRole, useAllUsers } from '../hooks/useUserRole';
import { useTeams } from '../hooks/useTeams';
import { getPermissions, resolveBuiltinFields, resolveFieldDepts } from '../types';
import type { Task, TaskCategory, SubTask } from '../types';
import TaskDetailPanel from '../components/TaskDetailPanel';

function App() {
  const { user, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const { appUser, loading: roleLoading, updateDisplayName, updateDepartment, updateSelectedTeams, updateDefaultTeam } = useUserRole(user);
  const { users: allUsers } = useAllUsers();

  const { projects, loading: projLoading, addProject } = useProjects();
  const [projectId, setProjectId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'all'>('all');
  const [loadingDone, setLoadingDone] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() =>
    localStorage.getItem('activeTeamId') ?? null
  );
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const { members } = useMembers();
  const { vacations, addVacation, deleteVacation } = useVacations();
  const { teams, loading: teamsLoading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updatePartFormConfig, clearPartFormConfig, updateMetaFields, updatePartMetaFields, clearPartMetaFields, updateSubTaskTypes, updatePartSubTaskTypes, clearPartSubTaskTypes } = useTeams(user?.uid);

  // activeTeamId 유효성 검사 — 선택 팀 목록이 바뀔 때 보정
  useEffect(() => {
    const ids = appUser?.selectedTeamIds ?? [];
    if (ids.length === 0) {
      setActiveTeamId(null);
      localStorage.removeItem('activeTeamId');
    } else if (!activeTeamId || !ids.includes(activeTeamId)) {
      const preferred = (appUser?.defaultTeamId && ids.includes(appUser.defaultTeamId))
        ? appUser.defaultTeamId
        : ids[0];
      setActiveTeamId(preferred);
      localStorage.setItem('activeTeamId', preferred);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.selectedTeamIds?.join(',')]);

  const handleActiveTeamChange = (id: string) => {
    setActiveTeamId(id);
    localStorage.setItem('activeTeamId', id);
  };

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
  const { tasks, addTask, updateTask, deleteTask, cleanupOrphanTasks } = useTasks(projectId, activeTeamId);
  const selectedTeam = teams.find(t => t.id === activeTeamId) ?? null;
  const activeParts = selectedTeam?.parts ?? [];
  const teamMembers = selectedTeam
    ? allUsers.filter(u => u.selectedTeamIds?.includes(selectedTeam.id))
        .map(u => ({ name: u.displayName, department: u.department }))
    : [];
  const teamAssignees = teamMembers.map(m => m.name);

  // 활성 카테고리에 해당하는 파트 (없으면 undefined → 팀 기본 설정 사용)
  const activePart = activeCategory !== 'all'
    ? activeParts.find(p => p.name === activeCategory)
    : undefined;
  // 파트 formConfig가 있으면 사용하되, 팀 레벨의 department/departments 설정을 필드별로 fallback 병합
  const effectiveFormConfig = useMemo(() => {
    const partConfig = activePart?.formConfig;
    const teamConfig = selectedTeam?.formConfig;
    if (!partConfig) return teamConfig;
    if (!teamConfig?.builtinFields?.length) return partConfig;
    const partFields = resolveBuiltinFields(partConfig);
    const teamFields = resolveBuiltinFields(teamConfig);
    const merged = partFields.map(pf => {
      if (resolveFieldDepts(pf)) return pf;
      const tf = teamFields.find(f => f.key === pf.key);
      if (!tf) return pf;
      return { ...pf, departments: tf.departments, department: tf.department };
    });
    return { ...partConfig, builtinFields: merged };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePart?.formConfig, selectedTeam?.formConfig]);

  // 파트 필터 (팀 필터는 useTasks 쿼리에서 처리)
  const filteredTasks = activeParts.length > 0
    ? tasks.filter(t => activeParts.some(p => p.name === t.category))
    : tasks;

  const validCategories = activeParts.map(p => p.name);
  const orphanTaskCount = activeParts.length > 0
    ? tasks.filter(t => !validCategories.includes(t.category ?? '')).length
    : 0;

  // task.subTaskData 내장 데이터 → SubTask 배열로 변환 (Firestore subtasks 컬렉션 미사용)
  const subtasks = useMemo<SubTask[]>(() =>
    filteredTasks.flatMap(task =>
      Object.entries(task.subTaskData ?? {}).map(([key, entry]) => ({
        id: `${task.id}__${key}`,
        taskId: task.id,
        projectId: task.projectId ?? '',
        title: key,
        category: task.category,
        type: task.type,
        status: (entry.status ?? '진행 전') as SubTask['status'],
        assignee:  entry.assignee ?? '',
        receiver:  '',
        startDate: entry.startDate ?? '',
        endDate:   entry.endDate   ?? '',
        weeklyHours: entry.weeklyHours,
        totalHours:  entry.totalHours,
        revisionLevel: 0,
        createdAt: task.createdAt,
      }))
    )
  , [filteredTasks]);

  const addTaskForTeam = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
    addTask({ ...data, teamId: activeTeamId ?? '' });

  if (authLoading || (user && roleLoading)) {
    return <LoadingScreen done={false} onFinished={() => {}} />;
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
        />
      )}

      <BrowserRouter>
        <RouteWatcher onRouteChange={path => { if (path !== '/tasks') setDetailTaskId(null); }} />
        <Layout
          project={currentProject}
          projects={projects}
          onProjectChange={setProjectId}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          user={user}
          appUser={appUser}
          onSignOut={signOut}
          teams={teams}
          teamsLoading={teamsLoading}
          activeTeamId={activeTeamId}
          onActiveTeamChange={handleActiveTeamChange}
        >
          <Routes>
            <Route path="/" element={
              <Dashboard tasks={filteredTasks} subtasks={subtasks} project={currentProject} parts={activeParts} assignees={teamAssignees} formConfig={effectiveFormConfig} teamMembers={teamMembers} />
            } />
            <Route path="/tasks" element={
              <TaskManagement
                tasks={filteredTasks} onAddTask={addTaskForTeam} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} onOpenDetail={setDetailTaskId} projectId={projectId}
                activeCategory={activeCategory} onCategoryChange={setActiveCategory}
                canManage={permissions.canManageTasks}
                parts={activeParts}
                assignees={teamAssignees}
                teamMembers={teamMembers}
                formConfig={effectiveFormConfig}
                builtinFields={resolveBuiltinFields(effectiveFormConfig)}
                metaFields={selectedTeam?.metaFields}
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
                    onUpdateSelectedTeams={updateSelectedTeams}
                    onUpdateDefaultTeam={updateDefaultTeam}
                    teams={teams}
                    teamsLoading={teamsLoading}
                    onCreateTeam={createTeam}
                    onUpdateTeam={updateTeam}
                    onSetParts={setParts}
                    onDeleteTeam={deleteTeam}
                    onUpdateFormConfig={updateFormConfig}
                    onUpdatePartFormConfig={updatePartFormConfig}
                    onClearPartFormConfig={clearPartFormConfig}
                    onUpdateMetaFields={updateMetaFields}
                    onUpdatePartMetaFields={updatePartMetaFields}
                    onClearPartMetaFields={clearPartMetaFields}
                    onUpdateSubTaskTypes={updateSubTaskTypes}
                    onUpdatePartSubTaskTypes={updatePartSubTaskTypes}
                    onClearPartSubTaskTypes={clearPartSubTaskTypes}
                    orphanTaskCount={orphanTaskCount}
                    onCleanupOrphanTasks={() => cleanupOrphanTasks(validCategories)}
                  />
                : <div className="flex items-center justify-center h-40 text-sm text-gray-400">로딩 중...</div>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>

        {(() => {
          const detailTask = tasks.find(t => t.id === detailTaskId);
          if (!detailTask) return null;
          const taskPart = activeParts.find(p => p.name === detailTask.category);
          const resolvedMetaFields = taskPart?.metaFields ?? selectedTeam?.metaFields;
          const resolvedFormConfig = taskPart?.formConfig ?? selectedTeam?.formConfig;
          return (
            <TaskDetailPanel
              task={detailTask}
              onClose={() => setDetailTaskId(null)}
              onUpdate={updateTask}
              onDelete={(id) => { deleteTask(id); setDetailTaskId(null); }}
              assignees={teamAssignees}
              parts={activeParts}
              canManage={permissions.canManageTasks}
              metaFields={resolvedMetaFields}
              subTaskTypes={taskPart?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? []}
              teamMembers={teamMembers}
              formConfig={resolvedFormConfig}
            />
          );
        })()}
      </BrowserRouter>
    </>
  );
}

export default App;
