import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
config({ path: './.env' });

async function checkInsights() {
  const service = new TrafficService();
  const workspaces = service.getWorkspaces();
  const ws = workspaces[0].id;
  const accounts = await service.getAccounts(ws);
  const act = accounts.find(a => a.name.includes('WeSparkle')) || accounts[0];
  
  const token = (service as any).getToken(ws);
  const url = `https://graph.facebook.com/v20.0/${act.id}/insights?fields=campaign_id,campaign_name,actions&date_preset=last_30d&level=campaign&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  
  if (json.data && json.data.length > 0) {
      console.log(JSON.stringify(json.data.find((d: any) => d.actions), null, 2));
  }
}

checkInsights();
