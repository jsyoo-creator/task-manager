// GET /api/v1/teams/:teamId/tasks?month=YYYY-MM(선택) — 그 팀의 업무 목록.
// customFields/subTaskData 등 화면에 보이는 모든 필드를 그대로 반환. 읽기 전용.
// 소프트 삭제된 업무(deletedAt 있음)는 화면에서도 안 보이므로 제외한다.
import { verifyApiKey, setCors } from '../../../_lib/verifyApiKey.js';

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

    const snap = await scope.db.collection('tasks').where('teamId', '==', teamId).get();
    let tasks = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => !t.deletedAt);
    if (month) tasks = tasks.filter(t => t.taskMonth === month);

    res.status(200).json({ tasks });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
