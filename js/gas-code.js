// 貼到 Google Apps Script 的程式碼：計劃版和 Google 日曆之間的橋樑。
// 這段程式在使用者自己的 Google 帳號裡執行（免費），計劃版用一組只屬於他的密碼跟它溝通。
// 程式刻意寫得很單純：要放進日曆的行程內容都由網站算好，這裡只負責讀寫 Google 日曆，
// 這樣網站更新時，大部分情況都不用請使用者重新貼程式。
// 真的要改這裡的程式時，把 SCRIPT_VERSION 加一，設定裡會提醒使用者更新。
export const SCRIPT_VERSION = 2;

export function scriptCode(key) {
  return TEMPLATE.replace('__PLANNER_KEY__', key).replace('__VERSION__', String(SCRIPT_VERSION));
}

const TEMPLATE = String.raw`/**
 * 計劃版 ⇄ Google 日曆
 *
 * 這段程式讓「計劃版」網站和你的 Google 日曆自動同步：
 *   - 計劃版有日期的任務和目標期限，會放進 Google 日曆裡的「計劃版」日曆
 *   - 你 Google 日曆裡的行程，會顯示在計劃版的行事曆和「今天」（只會讀，不會改）
 *   - 每天把計劃版的資料備份一份到你的 Google 雲端硬碟（「計劃版備份」資料夾，留最近 30 份）
 *
 * 它在你自己的 Google 帳號裡執行，只有知道下面那組密碼的計劃版能使用它。
 * 不要把這段程式、密碼和部署後的網址給別人。
 * 設定步驟在計劃版的「設定 → Google 日曆」。
 */

var PLANNER_KEY = '__PLANNER_KEY__';
var VERSION = __VERSION__;
var CALENDAR_NAME = '計劃版';

// 想確認設定好了沒：在上面選 test，按「執行」，下方的執行記錄會列出你的日曆
function test() {
  if (typeof Calendar === 'undefined') {
    throw new Error('還沒加入「Google Calendar API」服務：左邊「服務」旁邊按 ＋，選 Google Calendar API，再按「新增」。');
  }
  var cals = listCalendars_();
  Logger.log('設定完成！找到 ' + cals.length + ' 個日曆：' + cals.map(function (c) { return c.name; }).join('、'));
}

function doGet(e) {
  return reply_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var req = {};
  try {
    req = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}');
  } catch (err) {
    req = {};
  }
  return reply_(req);
}

function reply_(req) {
  var out;
  try {
    out = route_(req || {});
  } catch (err) {
    out = { ok: false, error: 'failed', message: message_(err) };
  }
  out.version = VERSION;
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  if (String(req.key || '') !== PLANNER_KEY) return { ok: false, error: 'bad-key' };
  if (typeof Calendar === 'undefined') return { ok: false, error: 'no-calendar-service' };
  if (req.action === 'ping') {
    return { ok: true, calendars: listCalendars_(), plannerCalendarId: props_().getProperty('plannerCalendarId') || '' };
  }
  if (req.action === 'events') return listEvents_(req);
  if (req.action === 'sync') return sync_(req);
  if (req.action === 'backup') return backup_(req);
  return { ok: false, error: 'bad-action' };
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function message_(err) {
  return String(err && err.message ? err.message : err);
}

// ---------- 你的日曆清單 ----------
function listCalendars_() {
  var out = [];
  var pageToken = '';
  do {
    var opts = { maxResults: 250 };
    if (pageToken) opts.pageToken = pageToken;
    var res = Calendar.CalendarList.list(opts);
    var items = res.items || [];
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      out.push({
        id: c.id,
        name: c.summaryOverride || c.summary || c.id,
        color: c.backgroundColor || '',
        primary: !!c.primary,
        selected: !!c.selected,
        role: c.accessRole || '',
      });
    }
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return out;
}

// ---------- 讀行程（給計劃版顯示用，只讀） ----------
function isDeclined_(ev) {
  var people = ev.attendees || [];
  for (var i = 0; i < people.length; i++) {
    if (people[i].self && people[i].responseStatus === 'declined') return true;
  }
  return false;
}

function isPlannerEvent_(ev) {
  return !!(ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.planner === '1');
}

function listEvents_(req) {
  var from = new Date(req.from);
  var to = new Date(req.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return { ok: false, error: 'bad-range' };
  var ids = req.calendars;
  if (typeof ids === 'string') ids = ids ? ids.split(',') : [];
  if (!ids || !ids.length) {
    ids = listCalendars_().filter(function (c) { return c.selected; }).map(function (c) { return c.id; });
  }
  var skip = props_().getProperty('plannerCalendarId') || '';
  var events = [];
  var errors = [];
  for (var i = 0; i < ids.length && events.length < 5000; i++) {
    var calId = String(ids[i] || '');
    if (!calId || calId === skip) continue;
    try {
      var pageToken = '';
      do {
        var opts = { timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 2500 };
        if (req.timeZone) opts.timeZone = String(req.timeZone);
        if (pageToken) opts.pageToken = pageToken;
        var res = Calendar.Events.list(calId, opts);
        var items = res.items || [];
        for (var j = 0; j < items.length; j++) {
          var ev = items[j];
          if (ev.status === 'cancelled' || isDeclined_(ev) || isPlannerEvent_(ev)) continue;
          var start = ev.start || {};
          var end = ev.end || {};
          events.push({
            cal: calId,
            id: ev.id,
            title: ev.summary || '',
            start: start.dateTime || start.date || '',
            end: end.dateTime || end.date || '',
            allDay: !!start.date,
            location: ev.location || '',
            link: ev.htmlLink || '',
            color: ev.colorId || '',
          });
        }
        pageToken = res.nextPageToken || '';
      } while (pageToken && events.length < 5000);
    } catch (err) {
      errors.push({ cal: calId, message: message_(err) });
    }
  }
  return { ok: true, events: events, errors: errors };
}

// ---------- 把計劃版的任務放進「計劃版」日曆 ----------
function sync_(req) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, error: 'busy' };
  try {
    var started = Date.now();
    var zone = String(req.timeZone || Session.getScriptTimeZone());
    var calId = ensureCalendar_(String(req.name || CALENDAR_NAME), String(req.calendarId || ''), zone);
    var have = listPlannerEvents_(calId, zone);
    var want = Array.isArray(req.events) ? req.events : [];
    var wanted = {};
    for (var i = 0; i < want.length; i++) {
      if (want[i] && want[i].id) wanted[want[i].id] = true;
    }
    var result = { ok: true, calendarId: calId, created: 0, updated: 0, removed: 0, done: true, errors: [], total: want.length };
    for (var k = 0; k < want.length; k++) {
      var ev = want[k];
      if (!ev || !ev.id) continue;
      var cur = have[ev.id];
      if (cur && !differs_(ev, cur)) continue;
      if (Date.now() - started > 240000) {
        result.done = false; // 一次做不完，計劃版會再叫一次
        break;
      }
      try {
        upsert_(calId, ev, !!cur);
        if (cur) result.updated++;
        else result.created++;
      } catch (err) {
        result.errors.push({ id: ev.id, message: message_(err) });
      }
    }
    if (result.done) {
      for (var id in have) {
        // 在 Google 日曆裡單獨改過的某一次重複行程不刪，免得那一次不見
        if (wanted[id] || have[id].recurringEventId) continue;
        if (Date.now() - started > 270000) {
          result.done = false;
          break;
        }
        try {
          Calendar.Events.remove(calId, id);
          result.removed++;
        } catch (err) {
          if (!/not found|deleted|gone|404|410/i.test(message_(err))) result.errors.push({ id: id, message: message_(err) });
        }
      }
    }
    result.errors = result.errors.slice(0, 20);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function ensureCalendar_(name, hint, zone) {
  var props = props_();
  var tries = [props.getProperty('plannerCalendarId'), hint];
  for (var i = 0; i < tries.length; i++) {
    if (!tries[i]) continue;
    try {
      var cal = Calendar.Calendars.get(tries[i]);
      if (cal && cal.id) {
        props.setProperty('plannerCalendarId', cal.id);
        return cal.id;
      }
    } catch (err) {
      // 這個日曆被刪掉了，往下找
    }
  }
  var list = listCalendars_();
  for (var j = 0; j < list.length; j++) {
    if (list[j].name === name && list[j].role === 'owner') {
      props.setProperty('plannerCalendarId', list[j].id);
      return list[j].id;
    }
  }
  var created = Calendar.Calendars.insert({
    summary: name,
    description: '由「計劃版」網站自動同步的任務與目標期限。在網站上修改，這裡會跟著更新。',
    timeZone: zone,
  });
  props.setProperty('plannerCalendarId', created.id);
  return created.id;
}

function listPlannerEvents_(calId, zone) {
  var map = {};
  var pageToken = '';
  do {
    var opts = { maxResults: 2500, showDeleted: false, privateExtendedProperty: 'planner=1', timeZone: zone };
    if (pageToken) opts.pageToken = pageToken;
    var res = Calendar.Events.list(calId, opts);
    var items = res.items || [];
    for (var i = 0; i < items.length; i++) map[items[i].id] = items[i];
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return map;
}

function upsert_(calId, ev, exists) {
  if (exists) return Calendar.Events.update(ev, calId, ev.id);
  try {
    return Calendar.Events.insert(ev, calId);
  } catch (err) {
    // 這個 ID 以前用過（行程被刪掉過），改成更新並恢復
    if (!/already exists|duplicate|409/i.test(message_(err))) throw err;
    ev.status = 'confirmed';
    return Calendar.Events.update(ev, calId, ev.id);
  }
}

// ---------- 備份到 Google 雲端硬碟 ----------
var BACKUP_PREFIX = '計劃版備份 ';
var BACKUP_KEEP = 30;

function backupFolder_() {
  var props = props_();
  var id = props.getProperty('backupFolderId');
  if (id) {
    try {
      var found = DriveApp.getFolderById(id);
      if (!found.isTrashed()) return found;
    } catch (err) {
      // 資料夾被刪掉了，重新建一個
    }
  }
  var folder = DriveApp.createFolder('計劃版備份');
  props.setProperty('backupFolderId', folder.getId());
  return folder;
}

function backup_(req) {
  if (!req.data || typeof req.data !== 'object') return { ok: false, error: 'bad-backup' };
  var day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.day || '')) ? String(req.day) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var name = BACKUP_PREFIX + day + '.json';
  var json = JSON.stringify(req.data);
  var folder = backupFolder_();
  // 同一天的備份直接覆蓋（丟到垃圾桶的不算）
  var target = null;
  var same = folder.getFilesByName(name);
  while (same.hasNext() && !target) {
    var s = same.next();
    if (!s.isTrashed()) target = s;
  }
  if (target) target.setContent(json);
  else folder.createFile(name, json, 'application/json');
  // 只留最近 30 份
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && f.getName().indexOf(BACKUP_PREFIX) === 0) files.push(f);
  }
  files.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
  for (var i = BACKUP_KEEP; i < files.length; i++) files[i].setTrashed(true);
  return { ok: true, file: name, folderUrl: folder.getUrl(), kept: Math.min(files.length, BACKUP_KEEP) };
}

function when_(t) {
  if (t && t.date) return 'd:' + t.date;
  if (t && t.dateTime) return 't:' + String(t.dateTime).slice(0, 16);
  return '';
}

function remKey_(list) {
  return JSON.stringify((list || []).map(function (r) { return r.method + ':' + r.minutes; }).sort());
}

function differs_(want, have) {
  var wantRem = remKey_(want.reminders && want.reminders.overrides);
  var haveRem = have.reminders && have.reminders.useDefault ? 'default' : remKey_(have.reminders && have.reminders.overrides);
  return (want.summary || '') !== (have.summary || '')
    || (want.description || '') !== (have.description || '')
    || (want.colorId || '') !== (have.colorId || '')
    || when_(want.start) !== when_(have.start)
    || when_(want.end) !== when_(have.end)
    || wantRem !== haveRem
    || (want.recurrence || []).join('|') !== (have.recurrence || []).join('|');
}
`;
