import { CalendarService } from './aria/packages/integrations/src/google-workspace/CalendarService';

async function test() {
    console.log('Testing CalendarService...');
    try {
        const calendarSvc = new CalendarService();
        const events = await calendarSvc.listEvents();
        console.log('Success! Found', events.length, 'events.');
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

test();
