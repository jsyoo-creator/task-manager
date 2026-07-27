// src/types/index.ts의 deriveSubtasksForTeam()을 그대로 포팅한 순수 함수(JS 버전).
// Vercel 서버리스 함수(api/**)가 프런트엔드 번들(src/**)과 별도로 빌드되는 구조라
// TS 소스를 직접 import하는 대신 로직을 복제해서 쓴다 — src/types/index.ts의
// deriveSubtasksForTeam이 바뀌면 이 파일도 같이 맞춰야 한다(주석으로 남겨둠).
export function deriveSubtasksForTeam(tasksForTeam, team, allProjectTasks, titlePrefix) {
  const activeParts = team?.parts ?? [];
  const subTaskTypeOrder = new Map();
  let orderIdx = 0;
  team?.subTaskTypes?.forEach(t => subTaskTypeOrder.set(t.id, orderIdx++));
  activeParts.forEach(p => p.subTaskTypes?.forEach(t => { if (!subTaskTypeOrder.has(t.id)) subTaskTypeOrder.set(t.id, orderIdx++); }));

  const reviewStatusToTaskStatus = (rs) => {
    if (rs === '검수 완료') return '완료';
    if (rs === '검수 중') return '진행 중';
    return '진행 전';
  };

  return tasksForTeam.flatMap(task => {
    const taskPartObj = activeParts.find(p => p.name === task.category);
    const plMainType = task.plTask
      ? (team?.plMainTaskTypes ?? []).find(m => task.plSelectedTypes?.includes(m.id))
      : undefined;
    let validTypes;
    if (task.plTask) {
      validTypes = plMainType?.subFields ?? [];
    } else {
      validTypes = taskPartObj?.subTaskTypes ?? team?.subTaskTypes;
    }
    const validTypeIds = validTypes ? new Set(validTypes.map(t => t.id)) : null;

    const taskNameMap = new Map();
    if (task.plTask) {
      plMainType?.subFields?.forEach(f => taskNameMap.set(f.id, f.name));
    } else {
      team?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
      taskPartObj?.subTaskTypes?.forEach(t => taskNameMap.set(t.id, t.name));
    }
    const withPrefix = (name) => titlePrefix ? `${titlePrefix} ${name}` : name;

    return Object.entries(task.subTaskData ?? {})
      .filter(([key]) => !validTypeIds || validTypeIds.has(key))
      .sort(([a], [b]) => (subTaskTypeOrder.get(a) ?? 999) - (subTaskTypeOrder.get(b) ?? 999))
      .flatMap(([key, entry]) => {
        const subField = plMainType?.subFields?.find(f => f.id === key);
        if (subField?.fieldType === 'review') {
          const checkedItems = (entry.checkedItems ?? []).filter(id =>
            (entry.reviewDates ?? {})[id]?.startDate
          );
          return checkedItems.map(itemId => {
            const reviewTask = allProjectTasks.find(t => t.id === itemId);
            const itemDates = (entry.reviewDates ?? {})[itemId] ?? {};
            const itemWeeklyHours = (entry.reviewWeeklyHours ?? {})[itemId] ?? {};
            const itemTotalHours = Object.values(itemWeeklyHours).reduce((a, b) => a + b, 0);
            const rs = (entry.reviewStatus ?? {})[itemId] ?? '검수 전';
            return {
              id: `${task.id}__${key}__${itemId}`,
              taskId: task.id,
              projectId: task.projectId ?? '',
              title: withPrefix(reviewTask?.title ?? itemId),
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

        return [{
          id: `${task.id}__${key}`,
          taskId: task.id,
          projectId: task.projectId ?? '',
          title: withPrefix(taskNameMap.get(key) ?? key),
          category: task.category,
          type: task.type,
          status: entry.status || '진행 전',
          assignee: entry.assignee ?? '',
          receiver: '',
          startDate: entry.startDate ?? '',
          endDate: entry.endDate ?? '',
          weeklyHours: entry.weeklyHours,
          totalHours: entry.totalHours,
          substituteWeeklyHours: entry.substituteWeeklyHours,
          substituteTotalHours: entry.substituteTotalHours,
          revisionLevel: 0,
          createdAt: task.createdAt,
        }];
      });
  });
}
