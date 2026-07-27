// GET /api/v1/teams/:teamId/weekly?month=YYYY-MM(선택) — 위클리 화면과 동일한
// 파생 세부업무 목록. deriveSubtasksForTeam()을 그대로 재사용(포팅본, api/_lib/deriveSubtasks.js).
// v1 한계: PL review 타입의 allProjectTasks 인자는 이 팀 자신의 tasks로 근사한다
// (팀 간 참조가 필요한 review 링크는 추후 보완).
import { verifyApiKey, setCors } from '../../../_lib/verifyApiKey.js';
import { deriveSubtasksForTeam } from '../../../_lib/deriveSubtasks.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET만 지원합니다.' }); return; }

  try {
    const scope = await verifyApiKey(req, res);
    if (!scope) return;

    const { teamId, month } = req.query;
    const teamDoc = await scope.db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists || teamDoc.data().workplaceId !== scope.workplaceId) {
      res.status(404).json({ error: '이 API 키로 접근할 수 없는 팀입니다.' });
      return;
    }
    const team = { id: teamDoc.id, ...teamDoc.data() };

    const snap = await scope.db.collection('tasks').where('teamId', '==', teamId).get();
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.deletedAt);
    if (month) tasks = tasks.filter(t => t.taskMonth === month);

    const weekly = deriveSubtasksForTeam(tasks, team, tasks);
    res.status(200).json({ weekly });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
