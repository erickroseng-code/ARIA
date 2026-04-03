import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
import * as fs from 'fs';
config({ path: './.env' });

async function search() {
  const service = new TrafficService();
  const accounts = await service.getAccounts('erick');
  const token = (service as any).getToken('erick');
  
  const results: any[] = [];
  for (const act of accounts) {
    if (act.id !== '1044207394498440' && act.id !== '719872676556171') {
      try {
        const url = `https://graph.facebook.com/v20.0/${act.id}/insights?fields=campaign_id,campaign_name,actions&date_preset=last_30d&level=campaign&access_token=${token}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.data) {
          json.data.forEach((c: any) => {
             if (c.actions) {
               const with9 = c.actions.find((a:any) => a.value === '9');
               const with4 = c.actions.find((a:any) => a.value === '4');
               const with2 = c.actions.find((a:any) => a.value === '2');
               if (with9 || with4 || with2) {
                 const messaging = c.actions.filter((a:any) => a.action_type.includes('mess') || a.action_type.includes('conversation'));
                 results.push({ account: act.name, campaign: c.campaign_name, messaging });
               }
             }
          });
        }
      } catch (e) {}
    }
  }
  
  fs.writeFileSync('test-output.json', JSON.stringify(results, null, 2));
  console.log('Saved to test-output.json');
}
search();
