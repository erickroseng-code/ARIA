import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
config({ path: './.env' });

async function check() {
  const service = new TrafficService();
  const token = (service as any).getToken('erick');
  // Account CA01 or WeSparkle
  const act = 'act_1044207394498440';
  const data = await service.getAccountInsights(act, 'erick', 'last_30d');
  console.log(JSON.stringify(data.campaigns.map(c => ({ name: c.campaign_name, conversions: c.conversions })), null, 2));
}

check();
