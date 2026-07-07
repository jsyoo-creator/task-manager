import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import AdminPage from '../pages/AdminPage';
import { useTeamNotices } from '../hooks/useTeamNotices';
import SettingsPage from '../pages/SettingsPage';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { useMembers } from '../hooks/useMembers';
import { useVacations } from '../hooks/useVacations';
import { useProfileFields } from '../hooks/useProfileFields';
import { useWorkplaces } from '../hooks/useWorkplaces';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { useRoleLabels } from '../hooks/useRoleLabels';
import { useAuth } from '../hooks/useAuth';
import { useUserRole, useAllUsers } from '../hooks/useUserRole';
import { useTeams } from '../hooks/useTeams';
import { useHolidays } from '../hooks/useHolidays';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { HolidaysContext } from '../contexts/HolidaysContext';
import { getPermissions, resolveBuiltinFields, mergeFormConfig, mergeAllPartsConfig, DEFAULT_BUILTIN_FIELD_CONFIGS, resolveRevisionSteps, isMenuEnabled } from '../types';
import type { Task, TaskCategory, SubTask, TeamFormConfig } from '../types';
import TaskDetailPanel from '../components/TaskDetailPanel';
import { db } from '../lib/firebase';
import { collection, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { Star } from 'lucide-react';

function App() {
  const { user, loading: authLoading, error: authError, signIn, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const { appUser, loading: roleLoading, updateDisplayName, updateDepartment, updateSelectedTeams, updateDefaultTeam, updateDefaultWorkplace } = useUserRole(user);

  // 근무지는 다중 배정이 가능 — activeWorkplaceId는 팀 전환(activeTeamId)과 동일한 방식으로
  // localStorage에 보관되는 "현재 작업 중인 근무지" 선택값
  const [activeWorkplaceId, setActiveWorkplaceIdState] = useState<string | null>(() =>
    localStorage.getItem('activeWorkplaceId') ?? null
  );
  useEffect(() => {
    if (authLoading) return; // 인증 확인 중(새로고침 직후 등)에는 손대지 않음
    // 실제 로그아웃 상태일 때만 선택을 초기화 — 다음 로그인 시 다시 물어봄
    if (!user) {
      setActiveWorkplaceIdState(null);
      localStorage.removeItem('activeWorkplaceId');
      return;
    }
    const ids = appUser?.workplaceIds ?? [];
    if (ids.length === 0) {
      setActiveWorkplaceIdState(null);
      localStorage.removeItem('activeWorkplaceId');
      return;
    }
    if (activeWorkplaceId && ids.includes(activeWorkplaceId)) return; // 이미 유효한 선택 유지

    // 새로 정해야 하는 상황: 근무지가 하나뿐이거나, 기본 근무지가 지정돼 있으면 자동 선택.
    // 그 외(근무지 2개 이상 + 기본 근무지 미지정)엔 null로 두어 "근무지 선택" 화면이 뜨게 한다.
    const preferred = ids.length === 1
      ? ids[0]
      : (appUser?.defaultWorkplaceId && ids.includes(appUser.defaultWorkplaceId) ? appUser.defaultWorkplaceId : null);
    if (preferred) {
      setActiveWorkplaceIdState(preferred);
      localStorage.setItem('activeWorkplaceId', preferred);
    } else {
      setActiveWorkplaceIdState(null);
      localStorage.removeItem('activeWorkplaceId');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, appUser?.workplaceIds?.join(','), appUser?.defaultWorkplaceId]);

  const handleActiveWorkplaceChange = (id: string) => {
    setActiveWorkplaceIdState(id);
    localStorage.setItem('activeWorkplaceId', id);
  };

  // 근무지가 바뀌면(어느 경로로 바뀌었든) 이전 근무지의 팀/프로젝트 선택이 새 근무지에
  // 그대로 남아 다른 근무지 데이터가 섞여 보이는 일이 없도록 초기화한다.
  const prevWorkplaceIdRef = useRef<string | null>(activeWorkplaceId);
  useEffect(() => {
    if (prevWorkplaceIdRef.current !== null && prevWorkplaceIdRef.current !== activeWorkplaceId) {
      setProjectId('');
      setActiveTeamId(null);
      localStorage.removeItem('activeTeamId');
    }
    prevWorkplaceIdRef.current = activeWorkplaceId;
  }, [activeWorkplaceId]);

  const { users: allUsers } = useAllUsers(activeWorkplaceId ?? undefined);

  // 일회성 마이그레이션: 근무지 개념 도입 이전 데이터를 'LG전자 공덕TF' 근무지로 태깅.
  // workplaces 컬렉션이 비어있고 workplaceId 없는 팀이 있을 때만 1회 실행 (idempotent).
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const wpSnap = await getDocs(collection(db, 'workplaces'));
        if (!wpSnap.empty) return;

        const teamsSnap = await getDocs(collection(db, 'teams'));
        const hasUnmigratedTeams = teamsSnap.docs.some(d => !d.data().workplaceId);
        if (!hasUnmigratedTeams) return;

        const wpRef = await addDoc(collection(db, 'workplaces'), {
          name: 'LG전자 공덕TF',
          createdAt: new Date().toISOString(),
        });
        const workplaceId = wpRef.id;

        const [projectsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'projects')),
          getDocs(collection(db, 'users')),
        ]);
        const batch = writeBatch(db);
        teamsSnap.docs.forEach(d => { if (!d.data().workplaceId) batch.update(d.ref, { workplaceId }); });
        projectsSnap.docs.forEach(d => { if (!d.data().workplaceId) batch.update(d.ref, { workplaceId }); });
        usersSnap.docs.forEach(d => {
          const u = d.data();
          const fields: Record<string, unknown> = {};
          if (!u.workplaceIds) fields.workplaceIds = [workplaceId];
          if (u.role === 'superadmin') fields.isPlatformAdmin = true;
          if (Object.keys(fields).length > 0) batch.update(d.ref, fields);
        });
        await batch.commit();
        console.log('[migration] 근무지 마이그레이션 완료:', workplaceId);
      } catch (e) {
        console.error('[migration] 근무지 마이그레이션 실패:', e);
      }
    })();
  }, [user]);

  // 일회성 백필: 다중 배정(workplaceIds) 도입 이전에 단일 workplaceId로 배정된 사용자 문서를
  // workplaceIds 배열로 보정 (이미 배열이 있으면 건드리지 않는 idempotent 연산).
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);
        let count = 0;
        usersSnap.docs.forEach(d => {
          const u = d.data() as { workplaceId?: string; workplaceIds?: string[] };
          if (!u.workplaceIds && u.workplaceId) {
            batch.update(d.ref, { workplaceIds: [u.workplaceId] });
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          console.log('[migration] workplaceIds 백필 완료:', count, '건');
        }
      } catch (e) {
        console.error('[migration] workplaceIds 백필 실패:', e);
      }
    })();
  }, [user]);

  // 일회성 백필: 근무지 개념 이전에는 역할 권한/공휴일/프로필 필드/휴가가 전역 문서(모든
  // 근무지가 공유)였음. 가장 먼저 생성된(=기존 데이터가 쌓인) 근무지로 귀속시켜, 새로
  // 만드는 근무지가 기존 근무지의 설정값을 그대로 물려받지 않도록 분리한다. (idempotent)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const wpSnap = await getDocs(query(collection(db, 'workplaces'), orderBy('createdAt', 'asc')));
        if (wpSnap.empty) return;
        const legacyWorkplaceId = wpSnap.docs[0].id;

        const [legacyRolePerms, scopedRolePerms, legacyHolidays, scopedHolidays, legacyProfileFields, scopedProfileFields] = await Promise.all([
          getDoc(doc(db, 'settings', 'rolePermissions')),
          getDoc(doc(db, 'settings', `rolePermissions_${legacyWorkplaceId}`)),
          getDoc(doc(db, 'config', 'holidays')),
          getDoc(doc(db, 'config', `holidays_${legacyWorkplaceId}`)),
          getDoc(doc(db, 'settings', 'profileFields')),
          getDoc(doc(db, 'settings', `profileFields_${legacyWorkplaceId}`)),
        ]);
        if (legacyRolePerms.exists() && !scopedRolePerms.exists()) {
          await setDoc(doc(db, 'settings', `rolePermissions_${legacyWorkplaceId}`), legacyRolePerms.data()!);
        }
        if (legacyHolidays.exists() && !scopedHolidays.exists()) {
          await setDoc(doc(db, 'config', `holidays_${legacyWorkplaceId}`), legacyHolidays.data()!);
        }
        if (legacyProfileFields.exists() && !scopedProfileFields.exists()) {
          await setDoc(doc(db, 'settings', `profileFields_${legacyWorkplaceId}`), legacyProfileFields.data()!);
        }

        const vacationsSnap = await getDocs(collection(db, 'vacations'));
        const batch = writeBatch(db);
        let count = 0;
        vacationsSnap.docs.forEach(d => {
          if (!d.data().workplaceId) {
            batch.update(d.ref, { workplaceId: legacyWorkplaceId });
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
          console.log('[migration] vacations workplaceId 백필 완료:', count, '건');
        }

        // defaultTeamId(단일, 근무지 구분 없음) → defaultTeamIdByWorkplace[legacyWorkplaceId]로 백필
        const usersSnap = await getDocs(collection(db, 'users'));
        const userBatch = writeBatch(db);
        let userCount = 0;
        usersSnap.docs.forEach(d => {
          const u = d.data() as { defaultTeamId?: string; defaultTeamIdByWorkplace?: Record<string, string> };
          if (u.defaultTeamId && !u.defaultTeamIdByWorkplace?.[legacyWorkplaceId]) {
            userBatch.update(d.ref, { [`defaultTeamIdByWorkplace.${legacyWorkplaceId}`]: u.defaultTeamId });
            userCount++;
          }
        });
        if (userCount > 0) {
          await userBatch.commit();
          console.log('[migration] defaultTeamIdByWorkplace 백필 완료:', userCount, '건');
        }

        const seatGroupsSnap = await getDocs(collection(db, 'seatGroups'));
        const seatBatch = writeBatch(db);
        let seatCount = 0;
        seatGroupsSnap.docs.forEach(d => {
          if (!d.data().workplaceId) {
            seatBatch.update(d.ref, { workplaceId: legacyWorkplaceId });
            seatCount++;
          }
        });
        if (seatCount > 0) {
          await seatBatch.commit();
          console.log('[migration] seatGroups workplaceId 백필 완료:', seatCount, '건');
        }
      } catch (e) {
        console.error('[migration] 근무지별 설정값 분리 실패:', e);
      }
    })();
  }, [user]);

  // 일회성 정리: 프로젝트 자동 생성 경합(workplaceId 백필 완료 전 순간에 projects가
  // 0건으로 잘못 관측되는 케이스)으로 한 근무지에 projects 문서가 2개 이상 생긴 경우,
  // 가장 먼저 생성된 문서를 정본으로 남기고 나머지가 참조하던 tasks/subtasks의
  // projectId를 정본으로 옮긴 뒤 중복 프로젝트 문서를 삭제한다. (중복이 없으면 no-op)
  useEffect(() => {
    if (!user || !activeWorkplaceId) return;
    (async () => {
      try {
        const projSnap = await getDocs(query(collection(db, 'projects'), where('workplaceId', '==', activeWorkplaceId)));
        if (projSnap.size < 2) return;
        const sorted = projSnap.docs.slice().sort((a, b) =>
          String(a.data().createdAt ?? '').localeCompare(String(b.data().createdAt ?? ''))
        );
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);
        for (const dup of duplicates) {
          const [tasksSnap, subtasksSnap] = await Promise.all([
            getDocs(query(collection(db, 'tasks'), where('projectId', '==', dup.id))),
            getDocs(query(collection(db, 'subtasks'), where('projectId', '==', dup.id))),
          ]);
          if (tasksSnap.size > 0 || subtasksSnap.size > 0) {
            const batch = writeBatch(db);
            tasksSnap.docs.forEach(d => batch.update(d.ref, { projectId: canonical.id }));
            subtasksSnap.docs.forEach(d => batch.update(d.ref, { projectId: canonical.id }));
            await batch.commit();
          }
          await deleteDoc(dup.ref);
          console.log(
            '[migration] 중복 프로젝트 정리 완료:', dup.id, '→', canonical.id,
            `(tasks ${tasksSnap.size}건, subtasks ${subtasksSnap.size}건 이전)`
          );
        }
      } catch (e) {
        console.error('[migration] 중복 프로젝트 정리 실패:', e);
      }
    })();
  }, [user, activeWorkplaceId]);

  const { projects, loading: projLoading, addProject } = useProjects(activeWorkplaceId ?? undefined);
  const [projectId, setProjectId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<TaskCategory | 'all'>('all');
  const [loadingDone, setLoadingDone] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() =>
    localStorage.getItem('activeTeamId') ?? null
  );
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const { members } = useMembers();
  const { vacations, addVacation, deleteVacation } = useVacations(activeWorkplaceId ?? undefined);
  const { teams, loading: teamsLoading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updateAllFormConfig, clearAllFormConfig, updatePartFormConfig, clearPartFormConfig, updateMetaFields, updatePartMetaFields, clearPartMetaFields, updateSubTaskTypes, updatePartSubTaskTypes, clearPartSubTaskTypes, updatePartCalendarOrder, clearPartCalendarOrder, updatePartPLShowInCalendar, clearPartPLShowInCalendar, updatePartMainTaskEndDateLabel, clearPartMainTaskEndDateLabel, updatePartMainTaskEndDateShow, clearPartMainTaskEndDateShow, updatePartMainTaskEndDateColor, clearPartMainTaskEndDateColor, updateRevisionSteps, updatePartRevisionSteps, clearPartRevisionSteps, updatePlMainTaskTypes, updateExcelConfig, updatePartExcelConfig, clearPartExcelConfig, updatePartWeeklyConfig, clearPartWeeklyConfig, reorderTeams } = useTeams(user?.uid, activeWorkplaceId ?? undefined);
  const { customHolidays, updateHolidays } = useHolidays(activeWorkplaceId ?? undefined);
  const { profileFields, updateProfileFields } = useProfileFields(activeWorkplaceId ?? undefined);
  const { workplaces } = useWorkplaces();
  const { rolePermissions, updateRolePermissions } = useRolePermissions(activeWorkplaceId ?? undefined);
  const { roleLabels, updateRoleLabels } = useRoleLabels(activeWorkplaceId ?? undefined);
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

  // selectedTeamIds는 근무지 구분 없는 전역 값이라 다른 근무지의 팀 id가 섞여 있을 수 있음 —
  // 현재 근무지의 teams에 실제로 속한 것만 걸러서 공지를 조회한다
  const teamNotices = useTeamNotices((appUser?.selectedTeamIds ?? []).filter(id => teams.some(t => t.id === id)));
  const unreadNoticeCount = teamNotices.filter(n => !readNoticeIds.has(n.id)).length;

  // activeTeamId 유효성 검사 — 선택 팀 목록이나 현재 근무지의 팀 목록이 바뀔 때 보정.
  // teams는 activeWorkplaceId 기준으로 로드되므로, 근무지를 전환해 teams가 새로 로드될 때도
  // 이 effect가 다시 실행되어 그 근무지의 기본(★) 팀으로 이동한다.
  useEffect(() => {
    const ids = (appUser?.selectedTeamIds ?? []).filter(id => teams.some(t => t.id === id));
    if (ids.length === 0) {
      if (activeTeamId !== null) {
        setActiveTeamId(null);
        localStorage.removeItem('activeTeamId');
      }
      return;
    }
    if (activeTeamId && ids.includes(activeTeamId)) return; // 이미 유효한 선택 유지
    const defaultForThisWorkplace = activeWorkplaceId ? appUser?.defaultTeamIdByWorkplace?.[activeWorkplaceId] : undefined;
    const preferred = (defaultForThisWorkplace && ids.includes(defaultForThisWorkplace))
      ? defaultForThisWorkplace
      : ids[0];
    setActiveTeamId(preferred);
    localStorage.setItem('activeTeamId', preferred);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.selectedTeamIds?.join(','), appUser?.defaultTeamIdByWorkplace, activeWorkplaceId, teams]);

  const handleActiveTeamChange = (id: string) => {
    setActiveTeamId(id);
    localStorage.setItem('activeTeamId', id);
  };

  // projectId 유효성 검사 — activeTeamId와 동일한 패턴: 근무지 전환 등으로 projects
  // 목록이 바뀌었는데 projectId가 그 목록에 더 이상 없으면(이전 근무지의 stale 값 포함)
  // 다시 선택한다. 단순히 "비어있을 때만 선택"하면, 근무지 전환 경합 중 이전 근무지의
  // projects가 잠깐 남아있는 렌더에서 잘못된 값으로 고정된 뒤 영영 교정되지 않는 문제가 있었음.
  useEffect(() => {
    if (projLoading || projects.length === 0) return;
    if (projectId && projects.some(p => p.id === projectId)) return; // 이미 유효한 선택 유지
    setProjectId(projects[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, projLoading]);

  useEffect(() => {
    // teams가 이미 존재하는 근무지는 "완전히 새로운 근무지"가 아니므로 절대 자동 생성하지 않음.
    // (projects 쿼리가 workplaceId 백필 완료 전 순간에 0건으로 잘못 관측되는 경합으로 중복 프로젝트가
    // 생성되는 사고를 막기 위한 가드 — teams와 projects는 항상 함께 존재해야 하는 근무지 데이터임)
    if (!projLoading && !teamsLoading && projects.length === 0 && teams.length === 0 && activeWorkplaceId) {
      addProject({
        workplaceId: activeWorkplaceId,
        name: '업무관리',
        categories: [],
      });
    }
  }, [projLoading, teamsLoading, projects.length, teams.length, activeWorkplaceId]);

  // 근무지별 메뉴 on/off 설정 — 어드민 페이지의 "메뉴 관리"에서 근무지마다 다르게 지정 가능
  const activeWorkplaceMenuConfig = workplaces.find(w => w.id === activeWorkplaceId)?.menuConfig;
  // 메뉴 id는 Firestore 맵 키 제약 때문에 경로가 아닌 별도 id로 저장됨(예: '/tasks' → 'tasks')
  const menuEnabled = (path: string) => isMenuEnabled(path.replace(/^\//, ''), activeWorkplaceMenuConfig);

  const currentProject = projects.find(p => p.id === projectId) ?? null;
  const { tasks, addTask, updateTask, deleteTask, cleanupOrphanTasks } = useTasks(projectId, activeTeamId);
  const selectedTeam = teams.find(t => t.id === activeTeamId) ?? null;
  const activeParts = selectedTeam?.parts ?? [];
  // 담당자 목록: 이 근무지에서의 기본 팀(defaultTeamIdByWorkplace)이 설정돼 있으면 그 기준으로,
  // 없으면 selectedTeamIds로 판단
  const getDefaultTeamId = (u: { defaultTeamIdByWorkplace?: Record<string, string> }) =>
    activeWorkplaceId ? u.defaultTeamIdByWorkplace?.[activeWorkplaceId] : undefined;
  const teamMembers = selectedTeam
    ? allUsers.filter(u => {
        const d = getDefaultTeamId(u);
        return d ? d === selectedTeam.id : u.selectedTeamIds?.includes(selectedTeam.id);
      }).map(u => ({ name: u.displayName, department: u.department }))
    : [];

  // 휴가 표시용: 위와 동일한 기준
  const vacTeamMembers = selectedTeam ? allUsers.filter(u => {
    const d = getDefaultTeamId(u);
    return d ? d === selectedTeam.id : u.selectedTeamIds?.includes(selectedTeam.id);
  }) : [];
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

  // 수정단계 목록 — 파트 하나만 선택된 경우 그 파트 기준, 아니면 팀 기본값
  const effectiveRevisionSteps = useMemo(
    () => resolveRevisionSteps(activePart, selectedTeam ?? undefined),
    [activePart, selectedTeam]
  );

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
    ? tasks.filter(t => {
        if (t.plTask && t.plParts?.length) {
          return !t.plParts.some(p => validCategories.includes(p));
        }
        return !validCategories.includes(t.category ?? '');
      }).length
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
  // 파트에 별도 subTaskTypes가 있으면 파트 설정 우선, 없으면 팀 기본 (SettingsPage 로직과 동일)
  // PL업무 표시 여부는 Team/TeamPart.plShowInCalendar로 별도 처리 (calendarSubtasks 참고)
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
    return set;
  }, [selectedTeam?.subTaskTypes, activeParts]);

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
      // PL업무: 파트 별도 설정 우선, 없으면 팀 기본 (없으면 표시)
      if (taskObj?.plTask) {
        return partObj?.plShowInCalendar ?? selectedTeam?.plShowInCalendar ?? true;
      }
      // 파트 별도 설정 우선, 없으면 팀 기본 사용 (SettingsPage 로직과 동일)
      const types = partObj?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? [];
      const typeConfig = types.find(t => t.id === subKey);
      if (typeConfig) return typeConfig.showInCalendar !== false;
      // subTaskTypes에 없는 타입: calendarVisibleTypeIds fallback
      return calendarVisibleTypeIds.has(subKey);
    }),
    [subtasks, calendarVisibleTypeIds, filteredTasks, activeParts, selectedTeam]
  );

  // 캘린더 카드 배경용 세부업무 유형 지정 색상 맵 (subtask.id → calendarColor hex)
  const subTaskColorMap = useMemo(() => {
    const map = new Map<string, string>();
    calendarSubtasks.forEach(s => {
      const subKey = s.id.split('__')[1];
      const taskObj = filteredTasks.find(t => t.id === s.taskId);
      const partObj = taskObj ? activeParts.find(p => p.name === taskObj.category) : undefined;
      const types = partObj?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? [];
      const color = types.find(t => t.id === subKey)?.calendarColor;
      if (color) map.set(s.id, color);
    });
    return map;
  }, [calendarSubtasks, filteredTasks, activeParts, selectedTeam]);

  // 캘린더 '세부업무별' 그룹핑용 정렬 순서 맵 (subtask.id → 캘린더 전용 순서)
  // TeamPart.calendarOrder / Team.calendarOrder — 업무상세에 쓰이는 subTaskTypes 배열 순서와는 별개의 값.
  // 파트에 별도 캘린더 순서가 없으면 팀 기본 캘린더 순서, 그마저 없으면 세부업무 목록 순서를 따름.
  const subTaskOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    calendarSubtasks.forEach(s => {
      const subKey = s.id.split('__')[1];
      const taskObj = filteredTasks.find(t => t.id === s.taskId);
      const partObj = taskObj ? activeParts.find(p => p.name === taskObj.category) : undefined;
      const types = partObj?.subTaskTypes ?? selectedTeam?.subTaskTypes ?? [];
      const savedOrder = partObj?.calendarOrder ?? selectedTeam?.calendarOrder;
      const orderIds = savedOrder ?? types.map(t => t.id);
      const idx = orderIds.indexOf(subKey);
      map.set(s.id, idx === -1 ? 999 : idx);
    });
    return map;
  }, [calendarSubtasks, filteredTasks, activeParts, selectedTeam]);

  const addTaskForTeam = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) =>
    addTask({ ...data, teamId: activeTeamId ?? '' });

  // 선택한 업무들을 지원팀에 새 업무로 등록 (메인 업무 정보만 복사, 세부업무/시간 데이터는 제외)
  const requestTasksToSupportTeam = async (taskIds: string[], targetTeamId: string, targetCategory: string, targetMonth: string) => {
    const selected = tasks.filter(t => taskIds.includes(t.id));
    await Promise.all(selected.map(t => addTask({
      projectId: t.projectId,
      teamId: targetTeamId,
      category: targetCategory,
      taskMonth: targetMonth,
      title: t.title,
      type: t.type,
      status: '진행 전',
      receiver: '',
      assignee: '',
      startDate: t.startDate,
      endDate: t.endDate,
      weeklyHours: {},
      totalHours: 0,
      revisionLevel: 0,
      memo: t.memo,
      requestedFromTeamId: activeTeamId ?? undefined,
      requestedFromTaskId: t.id,
    })));
  };

  if (authLoading || (user && roleLoading)) {
    return <LoadingScreen done={false} onFinished={() => {}} />;
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInWithEmail={signInWithEmail} onSignUpWithEmail={signUpWithEmail} error={authError} />;
  }

  if (appUser && !appUser.workplaceIds?.length && !appUser.isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-2 px-6">
          <p className="text-lg font-semibold text-gray-700">근무지 배정 대기 중</p>
          <p className="text-sm text-gray-400">관리자가 근무지를 배정하면 이용할 수 있습니다.</p>
          <button onClick={signOut} className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline">로그아웃</button>
        </div>
      </div>
    );
  }

  // 근무지가 2개 이상 배정된 사람은 로그인 시 어느 근무지에서 작업할지 먼저 선택해야 함
  if (appUser && !appUser.isPlatformAdmin && (appUser.workplaceIds?.length ?? 0) > 1 && !activeWorkplaceId) {
    const myWorkplaces = workplaces.filter(wp => appUser.workplaceIds!.includes(wp.id));
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-4 px-6 w-full max-w-sm">
          <div>
            <p className="text-lg font-semibold text-gray-700">근무지 선택</p>
            <p className="text-sm text-gray-400 mt-1">어느 근무지에서 작업하시겠어요?</p>
          </div>
          <div className="space-y-2">
            {myWorkplaces.map(wp => {
              const isDefault = appUser.defaultWorkplaceId === wp.id;
              return (
                <div key={wp.id} className="flex items-center gap-2">
                  <button
                    onClick={() => handleActiveWorkplaceChange(wp.id)}
                    className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-sm font-medium text-gray-700 transition-colors text-left"
                  >
                    <span className="truncate">{wp.name}</span>
                    {isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-semibold flex-shrink-0">기본</span>
                    )}
                  </button>
                  <button
                    onClick={() => updateDefaultWorkplace(isDefault ? null : wp.id)}
                    title={isDefault ? '기본 근무지 해제' : '기본 근무지로 설정 (다음부터 자동 입장)'}
                    className={`flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                      isDefault
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-500'
                        : 'bg-white border-gray-200 text-gray-300 hover:text-yellow-400 hover:border-yellow-300'
                    }`}
                  >
                    <Star size={16} fill={isDefault ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400">★ 를 누르면 다음 로그인부터 그 근무지로 자동 입장합니다</p>
          <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600 underline">로그아웃</button>
        </div>
      </div>
    );
  }

  const effectiveRolePerms = selectedTeam?.rolePermissions
    ? {
        manager: { ...rolePermissions.manager, ...selectedTeam.rolePermissions.manager },
        user:    { ...rolePermissions.user,    ...selectedTeam.rolePermissions.user },
      }
    : rolePermissions;
  const permissions = getPermissions(appUser?.role ?? 'user', effectiveRolePerms);
  const canSeeAll = true;
  const canSeeAllCalendarWeekly = permissions.canViewAllCalendarWeekly;
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
        <Routes>
          {/* 근무지 관리(플랫폼 관리자 전용)는 일반 업무관리 화면과 완전히 분리된 독립 페이지 */}
          <Route path="/admin/*" element={
            appUser?.isPlatformAdmin
              ? <AdminPage onSignOut={signOut} hasWorkspaceAccess={!!activeWorkplaceId} />
              : <Navigate to="/" replace />
          } />
          <Route path="/*" element={
            <>
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
          workplaces={workplaces}
          activeWorkplaceId={activeWorkplaceId}
          onActiveWorkplaceChange={handleActiveWorkplaceChange}
          onSetDefaultWorkplace={updateDefaultWorkplace}
          unreadNoticeCount={unreadNoticeCount}
          profileFields={profileFields}
          roleLabels={roleLabels}
          menuConfig={activeWorkplaceMenuConfig}
        >
          <Routes>
            <Route path="/" element={
              <Dashboard tasks={filteredTasks} subtasks={subtasks} project={currentProject} parts={activeParts} assignees={teamAssignees} formConfig={effectiveFormConfig} teamFormConfig={selectedTeam?.formConfig} teamMembers={teamMembers} revisionSteps={effectiveRevisionSteps} />
            } />
            <Route path="/tasks" element={!menuEnabled('/tasks') ? <Navigate to="/" replace /> : (
              <TaskManagement
                tasks={filteredTasks} onAddTask={addTaskForTeam} onUpdateTask={updateTask}
                onDeleteTask={deleteTask} onOpenDetail={setDetailTaskId} activeTaskId={detailTaskId} projectId={projectId}
                activeCategory={activeCategory} onCategoryChange={setActiveCategory}
                canCreate={permissions.canCreateTasks}
                canManage={permissions.canEditTasks}
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
                teams={teams}
                currentTeamId={activeTeamId ?? undefined}
                onRequestToSupportTeam={requestTasksToSupportTeam}
              />
            )} />
            <Route path="/calendar" element={!menuEnabled('/calendar') ? <Navigate to="/" replace /> : (
              <CalendarPage tasks={filteredTasks} subtasks={calendarSubtasks} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} onUpdateTask={updateTask} canManage={permissions.canEditTasks} assignees={teamAssignees} assigneesPerSubTaskType={assigneesPerSubTaskType} currentUserName={currentUserName} canSeeAll={canSeeAllCalendarWeekly} customHolidays={customHolidays} vacations={teamVacations} subTaskColorMap={subTaskColorMap} teamColor={selectedTeam?.color} subTaskOrderMap={subTaskOrderMap} groupBySubtaskType={selectedTeam?.calendarGroupBy === 'subtaskType'} mainTaskEndDateLabel={selectedTeam?.mainTaskEndDateLabel} mainTaskEndDateShow={selectedTeam?.mainTaskEndDateShow} mainTaskEndDateColor={selectedTeam?.mainTaskEndDateColor} plShowInCalendar={selectedTeam?.plShowInCalendar} />
            )} />
            <Route path="/weekly" element={!menuEnabled('/weekly') ? <Navigate to="/" replace /> : (
              <WeeklyPage tasks={filteredTasks} subtasks={subtasks} members={members} activeCategory={activeCategory} onCategoryChange={setActiveCategory} parts={activeParts} userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))} customHolidays={customHolidays} vacations={teamVacations} currentUserName={currentUserName} canSeeAll={canSeeAllCalendarWeekly} weeklyExportConfig={selectedTeam?.weeklyExportConfig} metaFields={selectedTeam?.metaFields} />
            )} />
            <Route path="/vacation" element={!menuEnabled('/vacation') ? <Navigate to="/" replace /> : (
              <VacationPage
                vacations={teamVacations}
                teamMembers={vacTeamMembers}
                currentUserName={currentUserName}
                userPhotoMap={new Map(allUsers.map(u => [u.displayName, u.photoURL]))}
                onAddVacation={addVacation}
                onDeleteVacation={deleteVacation}
              />
            )} />
            <Route path="/seats" element={!menuEnabled('/seats') ? <Navigate to="/" replace /> : <SeatMapPage canEdit={permissions.canEditSeatMap} teams={teams} allUsers={allUsers} workplaceId={activeWorkplaceId ?? undefined} />} />
            <Route path="/board" element={!menuEnabled('/board') ? <Navigate to="/" replace /> : (appUser ? <BoardPage appUser={appUser} teams={teams} onReadNotice={markNoticeRead} canSetNotice={permissions.canSetNotice} canManageBoard={permissions.canManageBoard} /> : null)} />
            <Route path="/accounts" element={
              permissions.canViewAccounts && menuEnabled('/accounts')
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
                    onUpdateDefaultTeam={(teamId: string | null) => activeWorkplaceId ? updateDefaultTeam(activeWorkplaceId, teamId) : Promise.resolve()}
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
                    onUpdatePartCalendarOrder={updatePartCalendarOrder}
                    onClearPartCalendarOrder={clearPartCalendarOrder}
                    onUpdatePartPLShowInCalendar={updatePartPLShowInCalendar}
                    onClearPartPLShowInCalendar={clearPartPLShowInCalendar}
                    onUpdatePartMainTaskEndDateLabel={updatePartMainTaskEndDateLabel}
                    onClearPartMainTaskEndDateLabel={clearPartMainTaskEndDateLabel}
                    onUpdatePartMainTaskEndDateShow={updatePartMainTaskEndDateShow}
                    onClearPartMainTaskEndDateShow={clearPartMainTaskEndDateShow}
                    onUpdatePartMainTaskEndDateColor={updatePartMainTaskEndDateColor}
                    onClearPartMainTaskEndDateColor={clearPartMainTaskEndDateColor}
                    onUpdateRevisionSteps={updateRevisionSteps}
                    onUpdatePartRevisionSteps={updatePartRevisionSteps}
                    onClearPartRevisionSteps={clearPartRevisionSteps}
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
                    roleLabels={roleLabels}
                    onUpdateRoleLabels={updateRoleLabels}
                    workplaceId={activeWorkplaceId ?? undefined}
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
          const resolvedRevisionSteps = resolveRevisionSteps(taskPart, selectedTeam ?? undefined);
          return (
            <TaskDetailPanel
              task={detailTask}
              onClose={() => setDetailTaskId(null)}
              onUpdate={updateTask}
              onDelete={(id) => { deleteTask(id); setDetailTaskId(null); }}
              assignees={teamAssignees}
              parts={activeParts}
              canManage={permissions.canEditTasks}
              canDelete={permissions.canDeleteTasks}
              metaFields={resolvedMetaFields}
              subTaskTypes={resolvedSubTaskTypes}
              revisionSteps={resolvedRevisionSteps}
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
            </>
          } />
        </Routes>
      </BrowserRouter>
    </>
    </HolidaysContext.Provider>
  );
}

export default App;
