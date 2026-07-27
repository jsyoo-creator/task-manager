// GET /api/v1/teams — 이 API 키의 workplace에 속한 모든 팀(파트·formConfig·
// subTaskTypes·subTaskGroups 등 설정 내용 포함) 목록. 읽기 전용.
import { verifyApiKey, setCors } from '../_lib/verifyApiKey.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET만 지원합니다.' }); return; }

  try {
    const scope = await verifyApiKey(req, res);
    if (!scope) return;

    const snap = await scope.db.collection('teams').where('workplaceId', '==', scope.workplaceId).get();
    const teams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json({ teams });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
