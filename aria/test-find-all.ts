import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
import * as fs from 'fs';
config({ path: './.env' });

async function search() {
  const service = new TrafficService();
  const accounts = await service.getAccounts('erick');
  const token = (service as any).getToken('erick');
  
  const presets = ['last_30d', 'maximum', 'this_month', 'last_month', 'this_year'];
  const results: any[] = [];
  
  for (const act of accounts) {
    if (act.id !== '1044207394498440' && act.id !== '719872676556171') {
      for (const preset of presets) {
          try {
            const url = `https://graph.facebook.com/v20.0/${act.id}/insights?fields=campaign_id,campaign_name,actions&date_preset=${preset}&level=campaign&access_token=${token}`;
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.data) {
              json.data.forEach((c: any) => {
                 if (c.actions) {
                   const messaging = c.actions.filter((a:any) => a.action_type.includes('mess') || a.action_type.includes('conversation'));
                   if (messaging.length > 0) {
                     results.push({
                        account: act.name,
                        campaign: c.campaign_name,
                        preset,
                        messaging
                     });
                   }
                 }
              });
            }
          } catch (e) {}
      }
    }
  }
  
  fs.writeFileSync('test-output-all.json', JSON.stringify(results, null, 2));
  console.log('Saved to test-output-all.json');
}
search();
