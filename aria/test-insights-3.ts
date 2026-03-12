import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
config({ path: './.env' });

async function check() {
  const service = new TrafficService();
  const token = (service as any).getToken('erick');
  // Account CA01
  const act = 'act_1044207394498440';
  const url = `https://graph.facebook.com/v20.0/${act}/insights?fields=campaign_id,campaign_name,actions&date_preset=last_30d&level=campaign&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();
  const campaign = json.data.find((c: any) => c.actions);
  console.log(JSON.stringify(campaign, null, 2));
}

check();
