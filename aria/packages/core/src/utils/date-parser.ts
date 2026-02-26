/**
 * Date Parser - Natural language date parsing for task creation
 * Handles relative dates like "amanhã", "sexta", "próxima segunda"
 * and time expressions like "14:00", "3pm", "à noite"
 */

export interface ParsedDate {
  date: Date | null;
  time?: string; // "14:00" format if time is specified
  relativeExpression?: string; // Original expression like "amanhã"
  isValid: boolean;
  error?: string; // Error message if parsing failed
}

/**
 * Get the next occurrence of a given weekday
 */
function getNextWeekday(
  dayName: string,
  baseDate: Date = new Date()
): Date {
  const dayMap: Record<string, number> = {
    segunda: 1,
    'segunda-feira': 1,
    monday: 1,
    terça: 2,
    'terça-feira': 2,
    tuesday: 2,
    quarta: 3,
    'quarta-feira': 3,
    wednesday: 3,
    quinta: 4,
    'quinta-feira': 4,
    thursday: 4,
    sexta: 5,
    'sexta-feira': 5,
    friday: 5,
    sábado: 6,
    saturday: 6,
    domingo: 0,
    sunday: 0,
  };

  const targetDay = dayMap[dayName.toLowerCase()];
  if (targetDay === undefined) return null!;

  const currentDay = baseDate.getDay();
  let daysAhead = targetDay - currentDay;

  // If the day is in the past this week, schedule it for next week
  if (daysAhead <= 0) {
    daysAhead += 7;
  }

  const result = new Date(baseDate);
  result.setDate(result.getDate() + daysAhead);
  return result;
}

/**
 * Parse relative date expressions like "amanhã", "próxima segunda", etc.
 */
export function parseDateExpression(
  expression: string,
  baseDate: Date = new Date()
): ParsedDate {
  if (!expression || typeof expression !== 'string') {
    return {
      date: null,
      isValid: false,
      error: 'Invalid expression',
    };
  }

  const lowerExpr = expression.toLowerCase().trim();

  // Today
  if (lowerExpr === 'hoje' || lowerExpr === 'today') {
    const today = new Date(baseDate);
    today.setHours(0, 0, 0, 0);
    return { date: today, isValid: true, relativeExpression: expression };
  }

  // Tomorrow
  if (lowerExpr === 'amanhã' || lowerExpr === 'tomorrow') {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return { date: tomorrow, isValid: true, relativeExpression: expression };
  }

  // Day after tomorrow
  if (lowerExpr === 'depois de amanhã' || lowerExpr === 'day after tomorrow') {
    const dayAfter = new Date(baseDate);
    dayAfter.setDate(dayAfter.getDate() + 2);
    dayAfter.setHours(0, 0, 0, 0);
    return { date: dayAfter, isValid: true, relativeExpression: expression };
  }

  // Next/This week patterns
  const weekPattern = /próxima\s+(\w+)/i;
  const weekMatch = lowerExpr.match(weekPattern);
  if (weekMatch && weekMatch[1]) {
    const dayName = weekMatch[1];
    const nextDate = getNextWeekday(dayName, baseDate);
    if (nextDate) {
      return { date: nextDate, isValid: true, relativeExpression: expression };
    }
  }

  // Just weekday name (próxima implicita)
  const weekdayPattern = /^(segunda|terça|quarta|quinta|sexta|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(-feira)?$/i;
  if (weekdayPattern.test(lowerExpr)) {
    const nextDate = getNextWeekday(lowerExpr, baseDate);
    if (nextDate) {
      return { date: nextDate, isValid: true, relativeExpression: expression };
    }
  }

  // "em X dias"
  const inDaysPattern = /em\s+(\d+)\s+dias?/i;
  const inDaysMatch = lowerExpr.match(inDaysPattern);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    if (!isNaN(days)) {
      const futureDate = new Date(baseDate);
      futureDate.setDate(futureDate.getDate() + days);
      futureDate.setHours(0, 0, 0, 0);
      return { date: futureDate, isValid: true, relativeExpression: expression };
    }
  }

  // Next week / próxima semana
  if (lowerExpr.includes('próxima semana') || lowerExpr.includes('next week')) {
    const nextWeek = new Date(baseDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    return { date: nextWeek, isValid: true, relativeExpression: expression };
  }

  // Next month / próximo mês
  if (lowerExpr.includes('próximo mês') || lowerExpr.includes('next month')) {
    const nextMonth = new Date(baseDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setHours(0, 0, 0, 0);
    return { date: nextMonth, isValid: true, relativeExpression: expression };
  }

  // ISO date format (YYYY-MM-DD)
  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
  const isoMatch = lowerExpr.match(isoPattern);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed, isValid: true, relativeExpression: expression };
    }
  }

  return {
    date: null,
    isValid: false,
    error: `Could not parse date: ${expression}`,
    relativeExpression: expression,
  };
}

/**
 * Parse time expressions like "14:00", "3pm", "à noite"
 */
export function parseTimeExpression(expression: string): ParsedDate {
  if (!expression || typeof expression !== 'string') {
    return {
      date: null,
      isValid: false,
      error: 'Invalid time expression',
    };
  }

  const lowerExpr = expression.toLowerCase().trim();

  // HH:MM format (24-hour)
  const timePattern = /(\d{1,2}):(\d{2})/;
  const timeMatch = lowerExpr.match(timePattern);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return {
        date: null,
        time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        isValid: true,
        relativeExpression: expression,
      };
    }
  }

  // 12-hour format with am/pm
  const ampmPattern = /(\d{1,2})\s*(:(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i;
  const ampmMatch = lowerExpr.match(ampmPattern);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
    const meridiem = ampmMatch[4].toLowerCase();

    // Convert to 24-hour format
    if (meridiem.includes('a')) {
      // AM: 12:xx am becomes 00:xx, other ams stay the same
      if (hours === 12) hours = 0;
    } else if (meridiem.includes('p')) {
      // PM: 12:xx pm stays 12:xx, others get +12
      if (hours !== 12) hours += 12;
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return {
        date: null,
        time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        isValid: true,
        relativeExpression: expression,
      };
    }
  }

  // Portuguese time expressions
  if (lowerExpr.includes('manhã') || lowerExpr.includes('morning')) {
    return {
      date: null,
      time: '09:00',
      isValid: true,
      relativeExpression: expression,
    };
  }

  if (lowerExpr.includes('à tarde') || lowerExpr.includes('afternoon')) {
    return {
      date: null,
      time: '14:00',
      isValid: true,
      relativeExpression: expression,
    };
  }

  if (lowerExpr.includes('à noite') || lowerExpr.includes('evening')) {
    return {
      date: null,
      time: '18:00',
      isValid: true,
      relativeExpression: expression,
    };
  }

  if (lowerExpr.includes('noite') || lowerExpr.includes('night')) {
    return {
      date: null,
      time: '20:00',
      isValid: true,
      relativeExpression: expression,
    };
  }

  return {
    date: null,
    isValid: false,
    error: `Could not parse time: ${expression}`,
    relativeExpression: expression,
  };
}

/**
 * Combine date and time into a full DateTime
 */
export function combineDateAndTime(
  dateResult: ParsedDate,
  timeResult: ParsedDate
): ParsedDate {
  if (!dateResult.isValid) {
    return dateResult;
  }

  if (!timeResult.isValid || !timeResult.time) {
    return dateResult;
  }

  const [hours, minutes] = timeResult.time.split(':').map(Number);
  const combined = new Date(dateResult.date!);
  combined.setHours(hours, minutes, 0, 0);

  return {
    date: combined,
    time: timeResult.time,
    isValid: true,
    relativeExpression: dateResult.relativeExpression,
  };
}

/**
 * Main function to parse any date/time string
 * Handles complex cases like "amanhã às 14:00", "próxima segunda 3pm", etc.
 */
export function parseDateTime(
  input: string,
  baseDate: Date = new Date()
): ParsedDate {
  if (!input || typeof input !== 'string') {
    return {
      date: null,
      isValid: false,
      error: 'Invalid input',
    };
  }

  const trimmed = input.trim();

  // Try to split by time separators
  const timeSeparators = ['às', 'at', 'em', 'às'];
  let dateStr = trimmed;
  let timeStr: string | null = null;

  for (const sep of timeSeparators) {
    const parts = trimmed.split(new RegExp(`\\s+${sep}\\s+`, 'i'));
    if (parts.length === 2) {
      dateStr = parts[0].trim();
      timeStr = parts[1].trim();
      break;
    }
  }

  // Parse date part
  const dateResult = parseDateExpression(dateStr, baseDate);
  if (!dateResult.isValid) {
    // Try to parse as time-only (might be "14:00" or "3pm")
    const timeOnlyResult = parseTimeExpression(dateStr);
    if (timeOnlyResult.isValid && timeOnlyResult.time) {
      // Time only, use today's date
      const today = new Date(baseDate);
      today.setHours(0, 0, 0, 0);
      const [hours, minutes] = timeOnlyResult.time.split(':').map(Number);
      today.setHours(hours, minutes, 0, 0);
      return {
        date: today,
        time: timeOnlyResult.time,
        isValid: true,
        relativeExpression: input,
      };
    }
    return dateResult;
  }

  // If we have a date, try to parse time part
  if (timeStr) {
    const timeResult = parseTimeExpression(timeStr);
    if (timeResult.isValid && timeResult.time) {
      return combineDateAndTime(dateResult, timeResult);
    }
  }

  return dateResult;
}
