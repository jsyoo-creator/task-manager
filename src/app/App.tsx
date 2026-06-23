import { useState, useEffect, useMemo, useCallback } from 'react';
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
import BoardPage from '../pages/BoardPage';
import { useTeamNotices } from '../hooks/useTeamNotices';
import SettingsPage from '../pages/SettingsPage';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import { useAuth } from '../hooks/useAuth';
import { useUserRole, useAllUsers } from '../hooks/useUserRole';
import { useTeams } from '../hooks/useTeams';
import { useHolidays } from '../hooks/useHolidays';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { HolidaysContext } from '../contexts/HolidaysContext';
import { getPermissions, resolveBuiltinFields, resolveFieldDepts } from '../types';
/** 파트 formConfig와 팀 formConfig를 병합. customLabel, departments 등은 팀에서 상속. */
function mergeFormConfig(partConfig: TeamFormConfig | undefined, teamConfig: TeamFormConfig | undefined): TeamFormConfig | undefined {
  if (!partConfig) return teamConfig;
  if (!teamConfig?.builtinFields?.length) return partConfig;
  const partFields = resolveBuiltinFields(partConfig);
  const teamFields = resolveBuiltinFields(teamConfig);
  const merged = partFields.map(pf => {
    const tf = teamFields.find(f => f.key === pf.key);
    if (!tf) return pf;
    return {
      ...pf,
      customLabel: pf.customLabel ?? tf.customLabel,
      customType: pf.customType ?? tf.customType,
      options: pf.options ?? tf.options,
      optionColors: pf.optionColors ?? tf.optionColors,
      ...(resolveFieldDepts(pf) ? {} : { departments: tf.departments, department: tf.department }),
    };
  });
  // 커스텀 필드: 팀 기본을 베이스로, 파트 오버라이드를 병합 (나중에 팀에 추가된 필드도 포함)
  const teamCfs = teamConfig.customFields ?? [];
  const partCfs = partConfig.customFields ?? [];
  const mergedCfs = [
    ...teamCfs.map(tcf => partCfs.find(pcf => pcf.id === tcf.id) ?? tcf),
    ...partCfs.filter(pcf => !teamCfs.some(tcf => tcf.id === pcf.id)),
  ];
  return { ...partConfig, builtinFields: merged, customFields: mergedCfs };
}
import type { Task, TaskCategory, SubTask, TeamFormConfig } from '../types';
import TaskDetailPanel from '../components/TaskDetailPanel';

function App() {
  const { user, loading: authLoading, error: authError, signIn, signInWithEmail, signUpWithEmail, signOut } = useAuth();
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
  const { teams, loading: teamsLoading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updatePartFormConfig, clearPartFormConfig, updateMetaFields, updatePartMetaFields, clearPartMetaFields, updateSubTaskTypes, updatePartSubTaskTypes, clearPartSubTaskTypes, updateExcelConfig, updatePartExcelConfig, clearPartExcelConfig, reorderTeams } = useTeams(user?.uid);
  const { customHolidays, updateHolidays } = useHolidays();
  const currentYear = new Date().getFullYear();
  const { holidays: publicHolidays } = usePublicHolidays(currentYear);
  const { holidays: nextYearHolidays } = usePublicHolidays(currentYear + 1);
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    [...publicHolidays, ...nextYearHolidays].forEach(h => map.set(h.date, h.name));
    customHolidays.forEach(h => map.set(h.date, h.name));
    return map;
  }, [publicHolidays, nextYearHolidays, customHolidays]);

  // ── 공지 읽음 추적 (localStorage, per-user) ──────────────────────
  const [readNoticeIds, setReadNoticeIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!appUser?.uid) return;
    try {
      const stored = localStorage.getItem(`noticeRead_${appUser.uid}`);
      setReadNoticeIds(new Set<string>(stored ? JSON.parse(stored) : []));
    } catch { setReadNoticeIds(new Set()); }
  }, [appUser?.uid]);

  const markNoticeRead = useCallback((postId: string) => {
    if (!appUser?.uid) return;
    setReadNoticeIds(prev => {
      if (prev.has(postId)) return prev;
      const next = new Set(prev);
      next.add(postId);
      localStorage.setItem(`noticeRead_${appUser.uid}`, JSON.stringify([...next]));
      return next;
    });
  }, [appUser?.uid]);

  const teamNotices = useTeamNotices(appUser?.selectedTeamIds ?? []);
  const unreadNoticeCount = teamNotices.filter(n => !readNoticeIds.has(n.id)).length;

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
  // 'all' 뷰에서 팀 config에 customType이 없으면 파트 중 하나에서 상속
  const effectiveFormConfig = useMemo(() => {
    const base = mergeFormConfig(activePart?.formConfig, selectedTeam?.formConfig);
    if (activePart) return base;
    // 팀 config에 status customType이 없으면 activeParts에서 찾아 보충
    const baseBuiltins = resolveBuiltinFields(base);
    const baseStatusFc = baseBuiltins.find(f => f.key === 'status');
    if (baseStatusFc?.customType === 'select' && baseStatusFc.options?.length) return base;
    const partWithStatus = activeParts.find(p => {
      const pBuiltins = resolveBuiltinFields(p.formConfig);
      const pSt = pBuiltins.find(f => f.key === 'status');
      return pSt?.customType === 'select' && pSt.options?.length;
    });
    if (partWithStatus) return mergeFormConfig(partWithStatus.formConfig, base);
    return base;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePart?.formConfig, activeParts, selectedTeam?.formConfig]);

  // 파트 필터 (팀 필터는 useTasks 쿼리에서 처리)
  const filteredTasks = activeParts.length > 0
    ? tasks.filter(t => activeParts.some(p => p.name === t.category))
    : tasks;

  const validCategories = activeParts.map(p => p.name);
  const orphanTaskCount = activeParts.length > 0
    ? tasks.filter(t => !validCategories.includes(t.category ?? '')).length
    : 0;

  // 세부업무 타입 ID별 담당자 목록 (SubTaskType.department 기준 필터)
  const assigneesPerSubTaskType = useMemo(() => {
    const map = new Map<string, string[]>();
    const allTypes = [
      ...(selectedTeam?.subTaskTypes ?? []),
      ...activeParts.flatMap(p => p.subTaskTypes ?? []),
    ];
    allTypes.forEach(type => {
      if (type.department) {
        map.set(type.id, teamMembers.filter(m => m.department === type.department).map(m => m.name));
      } else {
        map.set(type.id, teamAssignees);
      }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam?.subTaskTypes, activeParts, teamMembers, teamAssignees]);

  // SubTaskType ID → 이름 맵 (팀 + 파트 전체)
  const subTaskTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedTeam?.subTaskTypes?.forEach(t => map.set(t.id, t.name));
    activeParts.forEach(p => p.subTaskTypes?.forEach(t => map.set(t.id, t.name)));
    return map;
  }, [selectedTeam, activeParts]);

  // SubTaskType ID → 순서 인덱스 (subTaskTypes 정의 순서 유지용)
  const subTaskTypeOrder = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    selectedTeam?.subTaskTypes?.forEach(t => map.set(t.id, idx++));
    activeParts.forEach(p => p.subTaskTypes?.forEach(t => { if (!map.has(t.id)) map.set(t.id, idx++); }));
    return map;
  }, [selectedTeam?.subTaskTypes, activeParts]);

  // 캘린더 표시 여부 맵 (showInCalendar !== false 인 SubTaskType ID)
  const calendarVisibleTypeIds = useMemo(() => {
    const set = new Set<string>();
    const allTypes = [
      ...(selectedTeam?.subTaskTypes ?? []),
      ...activeParts.flatMap(p => p.subTaskTypes ?? []),
    ];
    allTypes.forEach(t => { if (t.showInCalendar !== false) set.add(t.id); });
    return set;
  }, [selectedTeam?.subTaskTypes, activeParts]);

  // task.subTaskData 내장 데이터 → SubTask 배열로 변환 (Firestore subtasks 컬렉션 미사용)
  const subtasks = useMemo<SubTask[]>(() =>
    filteredTasks.flatMap(task =>
      Object.entries(task.subTaskData ?? {})
        .sort(([a], [b]) => (subTaskTypeOrder.get(a) ?? 999) - (subTaskTypeOrder.get(b) ?? 999))
        .map(([key, entry]) => ({
          id: `${task.id}__${key}`,
          taskId: task.id,
          projectId: task.projectId ?? '',
          title: subTaskTypeMap.get(key) ?? key,
          category: task.category,
          type: task.type,
          status: (entry.status || '진행 전') as SubTask['status'],
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
  , [filteredTasks, subTaskTypeOrder]);

  // 캘린더 전용 서브태스크: showInCalendar !== false 인 타입만 포함
  const calendarSubtasks = useMemo(
    () => subtasks.filter(s => {
      const subKey = s.id.split('__')[1];
      return calendarVisibleTypeIds.has(subKey);
    }),
    [subtasks, calendarVisibleTypeIds]
  );

  const addTaskForTeam = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
    addTask({ ...data, teamId: activeTeamId ?? '' });

  if (authLoading || (user && roleLoading)) {
    return <LoadingScreen done={false} onFinished={() => {}} />;
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInWithEmail={signInWithEmail} onSignUpWithEmail={signUpWithEmail} error={authError} />;
  }

  const permissions = getPermissions(appUser?.role ?? 'user');
  const canSeeAll = appUser?.role === 'manager' || appUser?.role === 'superadmin';
  const currentUserName = appUser?.displayName ?? '';

  return (
    <HolidaysContext.Provider value={holidayMap}>
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
          unreadNoticeCount={unreadNoticeCount}
        >
          <Routes>
            <Route path="/" element={
              <Dashboard tasks={filteredTasks} subtasks={subtasks} project={currentProject} parts={activeParts} assignees={teamAssignees} formConfig={effectiveFormConfig} teamMembers={teamMembers} />
            } />
            <Route path="/tasks" element={
              <TaskManagement
                tasks={filteredTasks} onAddTask={addTaskForTeam} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} onOpenDetail={setDetailTaskId} activeTaskId={detailTaskId} projectId={projectId}
                activeCategory={activeCategory} onCategoryChange={setActiveCategory}
                canManage={permissions.canManageTasks}
                parts={activeParts}
                assignees={teamAssignees}
                teamMembers={teamMembers}
                formConfig={effectiveFormConfig}
                builtinFields={resolveBuiltinFields(effectiveFormConfig)}
                metaFields={selectedTeam?.metaFields}
                excelConfig={selectedTeam?.excelConfig}
                allMetaFields={selectedTeam?.metaFields}
                currentUserName={currentUserName}
                canSeeAll={canSeeAll}
                userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
              />
            } />
            <Route path="/calendar" element={
              <CalendarPage tasks={filteredTasks} subtasks={calendarSubtasks} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} onUpdateTask={updateTask} assignees={teamAssignees} assigneesPerSubTaskType={assigneesPerSubTaskType} currentUserName={currentUserName} canSeeAll={canSeeAll} customHolidays={customHolidays} vacations={vacations} />
            } />
            <Route path="/weekly" element={
              <WeeklyPage tasks={filteredTasks} subtasks={subtasks} members={members} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} customHolidays={customHolidays} currentUserName={currentUserName} canSeeAll={canSeeAll} />
            } />
            <Route path="/vacation" element={
              <VacationPage vacations={vacations} teamMembers={selectedTeam ? allUsers.filter(u => u.selectedTeamIds?.includes(selectedTeam.id)) : []} currentUserName={currentUserName} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} onAddVacation={addVacation} onDeleteVacation={deleteVacation} />
            } />
            <Route path="/seats" element={<SeatMapPage appUserRole={appUser?.role ?? 'user'} teams={teams} allUsers={allUsers} />} />
            <Route path="/board" element={appUser ? <BoardPage appUser={appUser} teams={teams} onReadNotice={markNoticeRead} /> : null} />
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
                    onUpdateExcelConfig={updateExcelConfig}
                    onUpdatePartExcelConfig={updatePartExcelConfig}
                    onClearPartExcelConfig={clearPartExcelConfig}
                    onReorderTeams={reorderTeams}
                    customHolidays={customHolidays}
                    onUpdateHolidays={updateHolidays}
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
          const resolvedFormConfig = mergeFormConfig(taskPart?.formConfig, selectedTeam?.formConfig);
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
              userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
              canSeeAll={canSeeAll}
              currentUserName={currentUserName}
            />
          );
        })()}
      </BrowserRouter>
    </>
    </HolidaysContext.Provider>
  );
}

export default App;
