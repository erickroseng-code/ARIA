import { TrafficService } from './apps/api/src/modules/traffic/traffic.service';
import { config } from 'dotenv';
config({ path: './.env' });

async function checkInsights() {
  const service = new TrafficService();
  const workspaces = service.getWorkspaces();
  
  for (const ws of workspaces) {
      console.log('--------- Checking workspace:', ws.id, '---------');
      const accounts = await service.getAccounts(ws.id);
      
      for (const act of accounts) {
          console.log('Account:', act.name, act.id);
          const token = (service as any).getToken(ws.id);
          const url = `https://graph.facebook.com/v20.0/${act.id}/insights?fields=campaign_id,campaign_name,actions&date_preset=last_30d&level=campaign&access_token=${token}`;
          const res = await fetch(url);
          const json = await res.json();
          if (json.data && json.data.length > 0) {
              const withActions = json.data.filter((d: any) => d.actions && d.actions.length > 0);
              console.log('Found', withActions.length, 'campaigns with actions');
              if (withActions.length > 0) {
                  // Print just the action types for the first one to find out the names
                  console.log('Action types found:', withActions[0].actions.map((a:any) => a.action_type));
              }
          }
      }
  }
}

checkInsights();
