import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Team, TeamPart, TeamFormConfig, MetaField, SubTaskType, SubTaskGroup, PLMainTaskType, CustomHoliday, ExcelFieldConfig, WeeklyExportConfig, RevisionStep, MailFormPreset } from '../types';

export function useTeams(uid?: string, workplaceId?: string) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !workplaceId) {
      setTeams([]);
      setLoading(false); // uid는 있지만 workplaceId 미확정(대기/미선택)이면 로딩 아님(빈 상태 확정)
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'teams'), where('workplaceId', '==', workplaceId)),
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Team))
          .sort((a, b) => {
            const ao = a.sortOrder ?? 999999;
            const bo = b.sortOrder ?? 999999;
            return ao !== bo ? ao - bo : a.createdAt.localeCompare(b.createdAt);
          });
        setTeams(data);
        setLoading(false);
      },
      err => {
        console.error('useTeams 구독 오류 (Firestore 권한 확인 필요):', err);
        setTeams([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid, workplaceId]);

  const createTeam = async (name: string, emoji: string): Promise<string> => {
    if (!workplaceId) throw new Error('워크플레이스가 지정되지 않았습니다');
    const ref = await addDoc(collection(db, 'teams'), {
      workplaceId,
      name,
      emoji,
      parts: [],
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  };

  const updateTeam = async (teamId: string, data: Partial<Omit<Team, 'id'>>) => {
    await updateDoc(doc(db, 'teams', teamId), data);
  };

  const setParts = async (teamId: string, parts: TeamPart[]) => {
    await updateDoc(doc(db, 'teams', teamId), { parts });
  };

  const deleteTeam = async (teamId: string) => {
    await deleteDoc(doc(db, 'teams', teamId));
  };

  const updateFormConfig = async (teamId: string, config: TeamFormConfig) => {
    await updateDoc(doc(db, 'teams', teamId), { formConfig: config });
  };

  const updateAllFormConfig = async (teamId: string, config: TeamFormConfig) => {
    await updateDoc(doc(db, 'teams', teamId), { allFormConfig: config });
  };

  const clearAllFormConfig = async (teamId: string) => {
    await updateDoc(doc(db, 'teams', teamId), { allFormConfig: null });
  };

  const updatePartFormConfig = async (teamId: string, partId: string, config: TeamFormConfig) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, formConfig: config } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartFormConfig = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { formConfig: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updateMetaFields = async (teamId: string, fields: MetaField[]) => {
    await updateDoc(doc(db, 'teams', teamId), { metaFields: fields });
  };

  const updateAllTeamsMetaFields = async (fields: MetaField[]) => {
    if (teams.length === 0) return;
    const batch = writeBatch(db);
    teams.forEach(team => batch.update(doc(db, 'teams', team.id), { metaFields: fields }));
    await batch.commit();
  };

  const updatePartMetaFields = async (teamId: string, partId: string, fields: MetaField[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, metaFields: fields } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updateSubTaskTypes = async (teamId: string, types: SubTaskType[]) => {
    await updateDoc(doc(db, 'teams', teamId), { subTaskTypes: types });
  };

  const updateRevisionSteps = async (teamId: string, steps: RevisionStep[]) => {
    await updateDoc(doc(db, 'teams', teamId), { revisionSteps: steps });
  };

  const updatePartSubTaskTypes = async (teamId: string, partId: string, types: SubTaskType[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, subTaskTypes: types } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartSubTaskTypes = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { subTaskTypes: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updateSubTaskGroups = async (teamId: string, groups: SubTaskGroup[]) => {
    await updateDoc(doc(db, 'teams', teamId), { subTaskGroups: groups });
  };

  const updatePartSubTaskGroups = async (teamId: string, partId: string, groups: SubTaskGroup[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, subTaskGroups: groups } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartSubTaskGroups = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { subTaskGroups: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  // subTaskTypes와 subTaskGroups는 둘 다 parts 배열 안에 같이 들어있는 필드라,
  // updatePartSubTaskTypes/updatePartSubTaskGroups를 따로(await 없이) 연달아 호출하면
  // 둘 다 "아직 안 바뀐" 같은 team.parts를 읽어 각자 parts 전체를 덮어쓰게 되고,
  // 나중에 도착하는 쪽이 상대방의 변경을 모른 채로 덮어써서 하나가 조용히 사라진다
  // (복사 시 groupIds 연결 유실, 그룹 삭제가 안 먹히는 문제의 원인). 두 필드를 한 번에
  // 계산해서 단일 updateDoc으로 저장해 이 경쟁을 없앤다.
  const updatePartSubTaskTypesAndGroups = async (teamId: string, partId: string, types: SubTaskType[], groups: SubTaskGroup[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, subTaskTypes: types, subTaskGroups: groups } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartSubTaskTypesAndGroups = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { subTaskTypes: _t, subTaskGroups: _g, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartCalendarOrder = async (teamId: string, partId: string, order: string[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, calendarOrder: order } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartCalendarOrder = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { calendarOrder: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartCopyIncludeDetails = async (teamId: string, partId: string, value: boolean) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, copyIncludeDetails: value } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartCopyIncludeDetails = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { copyIncludeDetails: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartTaskListTwoLine = async (teamId: string, partId: string, value: boolean) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, taskListTwoLine: value } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartTaskListTwoLine = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { taskListTwoLine: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartPLShowInCalendar = async (teamId: string, partId: string, value: boolean) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, plShowInCalendar: value } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartPLShowInCalendar = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { plShowInCalendar: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartMainTaskEndDateLabel = async (teamId: string, partId: string, label: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, mainTaskEndDateLabel: label } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartMainTaskEndDateLabel = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { mainTaskEndDateLabel: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartMainTaskEndDateShow = async (teamId: string, partId: string, value: boolean) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, mainTaskEndDateShow: value } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartMainTaskEndDateShow = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { mainTaskEndDateShow: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartMainTaskEndDateColor = async (teamId: string, partId: string, color: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, mainTaskEndDateColor: color } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartMainTaskEndDateColor = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { mainTaskEndDateColor: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartRevisionSteps = async (teamId: string, partId: string, steps: RevisionStep[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, revisionSteps: steps } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartRevisionSteps = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { revisionSteps: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartMetaFields = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { metaFields: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updateHolidays = async (teamId: string, holidays: CustomHoliday[]) => {
    await updateDoc(doc(db, 'teams', teamId), { holidays });
  };

  const updateExcelConfig = async (teamId: string, config: ExcelFieldConfig[]) => {
    await updateDoc(doc(db, 'teams', teamId), { excelConfig: config });
  };

  const updatePartExcelConfig = async (teamId: string, partId: string, config: ExcelFieldConfig[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, excelConfig: config } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartExcelConfig = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { excelConfig: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartMailFormConfig = async (teamId: string, partId: string, config: MailFormPreset[]) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, mailFormConfig: config } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartMailFormConfig = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { mailFormConfig: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePartWeeklyConfig = async (teamId: string, partId: string, config: WeeklyExportConfig) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => p.id === partId ? { ...p, weeklyExportConfig: config } : p);
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const clearPartWeeklyConfig = async (teamId: string, partId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newParts = team.parts.map(p => {
      if (p.id !== partId) return p;
      const { weeklyExportConfig: _, ...rest } = p;
      return rest;
    });
    await updateDoc(doc(db, 'teams', teamId), { parts: newParts });
  };

  const updatePlMainTaskTypes = async (teamId: string, types: PLMainTaskType[]) => {
    await updateDoc(doc(db, 'teams', teamId), { plMainTaskTypes: types });
  };

  const reorderTeams = async (ordered: Team[]) => {
    const batch = writeBatch(db);
    ordered.forEach((team, i) => {
      batch.update(doc(db, 'teams', team.id), { sortOrder: i });
    });
    await batch.commit();
  };

  return { teams, loading, createTeam, updateTeam, setParts, deleteTeam, updateFormConfig, updateAllFormConfig, clearAllFormConfig, updatePartFormConfig, clearPartFormConfig, updateMetaFields, updateAllTeamsMetaFields, updatePartMetaFields, clearPartMetaFields, updateSubTaskTypes, updatePartSubTaskTypes, clearPartSubTaskTypes, updateSubTaskGroups, updatePartSubTaskGroups, clearPartSubTaskGroups, updatePartSubTaskTypesAndGroups, clearPartSubTaskTypesAndGroups, updatePartCalendarOrder, clearPartCalendarOrder, updatePartPLShowInCalendar, clearPartPLShowInCalendar, updatePartCopyIncludeDetails, clearPartCopyIncludeDetails, updatePartTaskListTwoLine, clearPartTaskListTwoLine, updatePartMainTaskEndDateLabel, clearPartMainTaskEndDateLabel, updatePartMainTaskEndDateShow, clearPartMainTaskEndDateShow, updatePartMainTaskEndDateColor, clearPartMainTaskEndDateColor, updateRevisionSteps, updatePartRevisionSteps, clearPartRevisionSteps, updatePlMainTaskTypes, updateHolidays, updateExcelConfig, updatePartExcelConfig, clearPartExcelConfig, updatePartWeeklyConfig, clearPartWeeklyConfig, updatePartMailFormConfig, clearPartMailFormConfig, reorderTeams };
}
