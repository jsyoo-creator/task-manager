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
import AccountInfoPage from '../pages/AccountInfoPage';
import { useTeamNotices } from '../hooks/useTeamNotices';
import SettingsPage from '../pages/SettingsPage';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import { useProfileFields } from '../hooks/useProfileFields';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { useAuth } from '../hooks/useAuth';
import { useUserRole, useAllUsers } from '../hooks/useUserRole';
import { useTeams } from '../hooks/useTeams';
import { useHolidays } from '../hooks/useHolidays';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { HolidaysContext } from '../contexts/HolidaysContext';
import { getPermissions, resolveBuiltinFields, mergeFormConfig, mergeAllPartsConfig, DEFAULT_BUILTIN_FIELD_CONFIGS } from '../types';
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
  const { teams, loading: teamsLoading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updateAllFormConfig, clearAllFormConfig, updatePartFormConfig, clearPartFormConfig, updateMetaFields, updatePartMetaFields, clearPartMetaFields, updateSubTaskTypes, updatePartSubTaskTypes, clearPartSubTaskTypes, updatePlMainTaskTypes, updateExcelConfig, updatePartExcelConfig, clearPartExcelConfig, updatePartWeeklyConfig, clearPartWeeklyConfig, reorderTeams } = useTeams(user?.uid);
  const { customHolidays, updateHolidays } = useHolidays();
  const { profileFields, updateProfileFields } = useProfileFields();
  const { rolePermissions, updateRolePermissions } = useRolePermissions();
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
  // 담당자 목록: defaultTeamId가 현재 팀인 사람 우선, 미설정 시 selectedTeamIds 폴백
  const teamMembers = selectedTeam
    ? allUsers.filter(u =>
        u.defaultTeamId
          ? u.defaultTeamId === selectedTeam.id
          : u.selectedTeamIds?.includes(selectedTeam.id)
      ).map(u => ({ name: u.displayName, department: u.department }))
    : [];

  // 휴가 표시용: defaultTeamId 기준, 미설정 시 selectedTeamIds 폴백
  const vacTeamMembers = selectedTeam ? allUsers.filter(u =>
    u.defaultTeamId
      ? u.defaultTeamId === selectedTeam.id
      : u.selectedTeamIds?.includes(selectedTeam.id)
  ) : [];
  const vacMemberNames = new Set(vacTeamMembers.map(m => m.displayName));
  const teamVacations = vacations.filter(v => vacMemberNames.has(v.memberName));

  // 활성 카테고리에 해당하는 파트 (없으면 undefined → 팀 기본 설정 사용)
  const activePart = activeCategory !== 'all'
    ? activeParts.find(p => p.name === activeCategory)
    : undefined;
  // 파트에 직군이 연결된 경우 해당 직군 팀원만 표시
  const filteredTeamMembers = activePart?.departments?.length
    ? teamMembers.filter(m => m.department && activePart.departments!.includes(m.department))
    : teamMembers;
  const teamAssignees = filteredTeamMembers.map(m => m.name);
  // 파트 formConfig가 있으면 사용하되, 팀 레벨의 department/departments 설정을 필드별로 fallback 병합
  // 'all' 뷰: allFormConfig(전체 설정)가 있으면 팀 기본 위에 덮어씀
  const effectiveFormConfig = useMemo(() => {
    if (activePart) return mergeFormConfig(activePart.formConfig, selectedTeam?.formConfig);
    // 전체 뷰 — allFormConfig가 있으면 우선 적용, 없으면 파트 합집합 fallback
    const partsUnion = activeParts.length > 0
      ? mergeAllPartsConfig(activeParts, selectedTeam?.formConfig)
      : selectedTeam?.formConfig;
    const base = selectedTeam?.allFormConfig
      ? mergeFormConfig(selectedTeam.allFormConfig, partsUnion)
      : partsUnion;
    // 팀 config에 status customType이 없으면 activeParts에서 찾아 보충
    const baseBuiltins = resolveBuiltinFields(base);
    const baseStatusFc = baseBuiltins.find(f => f.key === 'status');
    let result = base;
    if (baseStatusFc?.customType !== 'select' || !baseStatusFc.options?.length) {
      const partWithStatus = activeParts.find(p => {
        const pBuiltins = resolveBuiltinFields(p.formConfig);
        const pSt = pBuiltins.find(f => f.key === 'status');
        return pSt?.customType === 'select' && pSt.options?.length;
      });
      if (partWithStatus) result = mergeFormConfig(partWithStatus.formConfig, base);
    }
    // 전체 탭: 파트마다 fieldOrder가 달라 컬럼 순서가 역전되는 문제 방지.
    // allFormConfig 또는 팀 기본 formConfig에 명시적 fieldOrder가 있으면 사용자 설정을 존중한다.
    if (result && !selectedTeam?.allFormConfig?.fieldOrder && !selectedTeam?.formConfig?.fieldOrder) {
      const defaultIdx: Record<string, number> = {};
      DEFAULT_BUILTIN_FIELD_CONFIGS.forEach((f, i) => { defaultIdx[f.key] = i; });
      const sortedBuiltins = resolveBuiltinFields(result)
        .sort((a, b) => (defaultIdx[a.key] ?? Infinity) - (defaultIdx[b.key] ?? Infinity));
      result = { ...result, builtinFields: sortedBuiltins, fieldOrder: undefined };
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePart?.formConfig, activeParts, selectedTeam?.formConfig, selectedTeam?.allFormConfig]);

  // 파트 필터 (팀 필터는 useTasks 쿼리에서 처리)
  const filteredTasks = useMemo(() => {
    if (activeParts.length === 0) return tasks;
    const activePartNames = new Set(activeParts.map(p => p.name));
    return tasks.filter(t =>
      t.plTask
        ? (t.plParts?.some(p => activePartNames.has(p)) ?? false)
        : activePartNames.has(t.category)
    );
  }, [tasks, activeParts]);

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

  // 캘린더 표시 여부 맵 (showInCalendar !== false 인 SubTaskType ID + 모든 PLSubTaskField ID)
  // 파트에 별도 subTaskTypes가 있으면 파트 설정 우선, 없으면 팀 기본 (SettingsPage 로직과 동일)
  const calendarVisibleTypeIds = useMemo(() => {
    const set = new Set<string>();
    const teamTypes = selectedTeam?.subTaskTypes ?? [];
    if (activeParts.length === 0) {
      teamTypes.forEach(t => { if (t.showInCalendar !== false) set.add(t.id); });
    } else {
      activeParts.forEach(p => {
        const types = p.subTaskTypes ?? teamTypes;
        types.forEach(t => { if (t.showInCalendar !== false) set.add(t.id); });
      });
    }
    selectedTeam?.plMainTaskTypes?.forEach(m => m.subFields?.forEach(f => set.add(f.id)));
    return set;
  }, [selectedTeam?.subTaskTypes, selectedTeam?.plMainTaskTypes, activeParts]);

  // task.subTaskData 내장 데이터 → SubTask 배열로 변환 (Firestore subtasks 컬렉션 미사용)
  // 파트별 별도 타입 우선, 없으면 팀 기본 타입 사용 (설정 페이지 로직과 동일)
  const subtasks = useMemo<SubTask[]>(() => {
    const reviewStatusToTaskStatus = (rs: string): SubTask['status'] => {
      if (rs === '검수 완료') return '완료';
      if (rs === '검수 중') return '진행 중';
      return '진행 전';
    };
    return filteredTasks.flatMap(task => {
      const taskPartObj = activeParts.find(p => p.name === task.category);
      const plMainType = task.plTask
        ? (selectedTeam?.plMainTaskTypes ?? []).find(m => task.plSelectedTypes?.includes(m.id))
        : undefined;
      let validTypes: Array<{ id: string; name: string }> | null | undefined;
      if (task.plTask) {
        validTypes = plMainType?.subFields ?? [];
      } else {
        validTypes = taskPartObj?.subTaskTypes ?? selectedTeam?.subTaskTypes;
      }
      const validTypeIds = validTypes ? new Set(validTypes.map(t => t.id)) : null;

      const taskNameMap = new Map<string, string>();
      if (task.plTask) {
        plMainType?.subFields?.forEach(f => taskNameMap.set(f.id, f.name));
      } else {
        selectedTeam?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
        taskPartObj?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
      }

      return Object.entries(task.subTaskData ?? {})
        .filter(([key]) => !validTypeIds || validTypeIds.has(key))
        .sort(([a], [b]) => (subTaskTypeOrder.get(a) ?? 999) - (subTaskTypeOrder.get(b) ?? 999))
        .flatMap(([key, entry]) => {
          // PL review 타입: 체크된 항목별로 개별 SubTask 생성
          const subField = plMainType?.subFields?.find(f => f.id === key);
          if (subField?.fieldType === 'review') {
            const checkedItems = (entry.checkedItems ?? []).filter(id =>
              (entry.reviewDates ?? {})[id]?.startDate
            );
            return checkedItems.map(itemId => {
              const reviewTask = tasks.find(t => t.id === itemId);
              const itemDates = (entry.reviewDates ?? {})[itemId] ?? {};
              const itemWeeklyHours = (entry.reviewWeeklyHours ?? {})[itemId] ?? {};
              const itemTotalHours = Object.values(itemWeeklyHours).reduce((a: number, b: number) => a + b, 0);
              const rs = (entry.reviewStatus ?? {})[itemId] ?? '검수 전';
              return {
                id: `${task.id}__${key}__${itemId}`,
                taskId: task.id,
                projectId: task.projectId ?? '',
                title: reviewTask?.title ?? itemId,
                category: task.category,
                type: task.type,
                status: reviewStatusToTaskStatus(rs),
                assignee: task.assignee ?? task.receiver ?? '',
                receiver: '',
                startDate: itemDates.startDate ?? '',
                endDate: itemDates.endDate ?? '',
                weeklyHours: itemWeeklyHours,
                totalHours: itemTotalHours,
                substituteWeeklyHours: undefined,
                substituteTotalHours: undefined,
                revisionLevel: 0,
                createdAt: task.createdAt,
              };
            });
          }

          // 일반 엔트리
          return [{
            id: `${task.id}__${key}`,
            taskId: task.id,
            projectId: task.projectId ?? '',
            title: taskNameMap.get(key) ?? key,
            category: task.category,
            type: task.type,
            status: (entry.status || '진행 전') as SubTask['status'],
            assignee:  entry.assignee ?? '',
            receiver:  '',
            startDate: entry.startDate ?? '',
            endDate:   entry.endDate   ?? '',
            weeklyHours: entry.weeklyHours,
            totalHours:  entry.totalHours,
            substituteWeeklyHours: entry.substituteWeeklyHours,
            substituteTotalHours:  entry.substituteTotalHours,
            revisionLevel: 0,
            createdAt: task.createdAt,
          }];
        });
    });
  }, [filteredTasks, subTaskTypeOrder, subTaskTypeMap, activeParts, selectedTeam, tasks]);

  // 캘린더 전용 서브태스크: task 파트의 별도 설정 우선, 없으면 팀 기본, 타입 없으면 fallback
  const calendarSubtasks = useMemo(
    () => subtasks.filter(s => {
      const subKey = s.id.split('__')[1];
      const taskObj = filteredTasks.find(t => t.id === s.taskId);
      const partObj = taskObj ? activeParts.find(p => p.name === taskObj.category) : undefined;
      // 파트 별도 설정 우선, 없으면 팀 기본 사용 (SettingsPage 로직과 동일)
      const types = partObj?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? [];
      const typeConfig = types.find(t => t.id === subKey);
      if (typeConfig) return typeConfig.showInCalendar !== false;
      // subTaskTypes에 없는 타입 (PL 등): calendarVisibleTypeIds fallback
      return calendarVisibleTypeIds.has(subKey);
    }),
    [subtasks, calendarVisibleTypeIds, filteredTasks, activeParts, selectedTeam]
  );

  const addTaskForTeam = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
    addTask({ ...data, teamId: activeTeamId ?? '' });

  if (authLoading || (user && roleLoading)) {
    return <LoadingScreen done={false} onFinished={() => {}} />;
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInWithEmail={signInWithEmail} onSignUpWithEmail={signUpWithEmail} error={authError} />;
  }

  const permissions = getPermissions(appUser?.role ?? 'user', rolePermissions);
  const canSeeAll = true;
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
          profileFields={profileFields}
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
                canDelete={permissions.canDeleteTasks}
                parts={activeParts}
                assignees={teamAssignees}
                teamMembers={filteredTeamMembers}
                formConfig={effectiveFormConfig}
                builtinFields={resolveBuiltinFields(effectiveFormConfig)}
                metaFields={selectedTeam?.metaFields}
                excelConfig={selectedTeam?.excelConfig}
                allMetaFields={selectedTeam?.metaFields}
                currentUserName={currentUserName}
                canSeeAll={canSeeAll}
                userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
                plMainTaskTypes={selectedTeam?.plMainTaskTypes}
              />
            } />
            <Route path="/calendar" element={
              <CalendarPage tasks={filteredTasks} subtasks={calendarSubtasks} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} onUpdateTask={updateTask} assignees={teamAssignees} assigneesPerSubTaskType={assigneesPerSubTaskType} currentUserName={currentUserName} canSeeAll={canSeeAll} customHolidays={customHolidays} vacations={teamVacations} />
            } />
            <Route path="/weekly" element={
              <WeeklyPage tasks={filteredTasks} subtasks={subtasks} members={members} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} customHolidays={customHolidays} vacations={teamVacations} currentUserName={currentUserName} canSeeAll={canSeeAll} weeklyExportConfig={selectedTeam?.weeklyExportConfig} metaFields={selectedTeam?.metaFields} />
            } />
            <Route path="/vacation" element={
              <VacationPage
                vacations={teamVacations}
                teamMembers={vacTeamMembers}
                currentUserName={currentUserName}
                userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
                onAddVacation={addVacation}
                onDeleteVacation={deleteVacation}
              />
            } />
            <Route path="/seats" element={<SeatMapPage appUserRole={appUser?.role ?? 'user'} teams={teams} allUsers={allUsers} />} />
            <Route path="/board" element={appUser ? <BoardPage appUser={appUser} teams={teams} onReadNotice={markNoticeRead} /> : null} />
            <Route path="/accounts" element={
              (appUser?.role === 'superadmin' || appUser?.role === 'manager')
                ? <AccountInfoPage allUsers={allUsers} teams={teams} profileFields={profileFields} />
                : <Navigate to="/" replace />
            } />
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
                    onUpdateAllFormConfig={updateAllFormConfig}
                    onClearAllFormConfig={clearAllFormConfig}
                    onUpdatePartFormConfig={updatePartFormConfig}
                    onClearPartFormConfig={clearPartFormConfig}
                    onUpdateMetaFields={updateMetaFields}
                    onUpdatePartMetaFields={updatePartMetaFields}
                    onClearPartMetaFields={clearPartMetaFields}
                    onUpdateSubTaskTypes={updateSubTaskTypes}
                    onUpdatePartSubTaskTypes={updatePartSubTaskTypes}
                    onClearPartSubTaskTypes={clearPartSubTaskTypes}
                    onUpdatePlMainTaskTypes={updatePlMainTaskTypes}
                    onUpdateExcelConfig={updateExcelConfig}
                    onUpdatePartExcelConfig={updatePartExcelConfig}
                    onClearPartExcelConfig={clearPartExcelConfig}
                    onUpdatePartWeeklyConfig={updatePartWeeklyConfig}
                    onClearPartWeeklyConfig={clearPartWeeklyConfig}
                    onReorderTeams={reorderTeams}
                    customHolidays={customHolidays}
                    onUpdateHolidays={updateHolidays}
                    orphanTaskCount={orphanTaskCount}
                    onCleanupOrphanTasks={() => cleanupOrphanTasks(validCategories)}
                    profileFields={profileFields}
                    onUpdateProfileFields={updateProfileFields}
                    rolePermissions={rolePermissions}
                    onUpdateRolePermissions={updateRolePermissions}
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
          const resolvedSubTaskTypes = (() => {
            if (detailTask.plTask) {
              const plMainType = (selectedTeam?.plMainTaskTypes ?? []).find(m =>
                detailTask.plSelectedTypes?.includes(m.id)
              );
              return (plMainType?.subFields ?? []).map(f => ({ id: f.id, name: f.name, department: f.department, departments: f.departments, plFieldType: f.fieldType }));
            }
            return taskPart?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? [];
          })();
          return (
            <TaskDetailPanel
              task={detailTask}
              onClose={() => setDetailTaskId(null)}
              onUpdate={updateTask}
              onDelete={(id) => { deleteTask(id); setDetailTaskId(null); }}
              assignees={teamAssignees}
              parts={activeParts}
              canManage={permissions.canManageTasks}
              canDelete={permissions.canDeleteTasks}
              metaFields={resolvedMetaFields}
              subTaskTypes={resolvedSubTaskTypes}
              teamMembers={teamMembers}
              formConfig={resolvedFormConfig}
              teamFormConfig={selectedTeam?.formConfig}
              userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
              canSeeAll={canSeeAll}
              currentUserName={currentUserName}
              vacations={teamVacations}
              reviewTasks={detailTask.plTask
                ? tasks.filter(t =>
                    !t.plTask &&
                    t.projectId === detailTask.projectId &&
                    t.id !== detailTask.id &&
                    (!detailTask.plParts?.length || detailTask.plParts.includes(t.category))
                  )
                : undefined}
            />
          );
        })()}
      </BrowserRouter>
    </>
    </HolidaysContext.Provider>
  );
}

export default App;
