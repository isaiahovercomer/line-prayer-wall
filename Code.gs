/**
 * 我的代禱卡．小區代禱牆 — Google Apps Script 後端
 * 貼到 Google 試算表的「擴充功能 → Apps Script」。第一次（或更新程式後）執行一次 setup()，再部署新版本。
 */

const CONFIG = {
  CHANNEL_ID: '2012412693', // LINE Developers → LINE Login channel → Basic settings 的 Channel ID
};

const SH = { WALLS: '代禱牆', NAMES: '代禱名單', PUBLISHERS: '發布者', CARDS: '代禱卡', JOINED: '參與紀錄' };

const HEADERS = {
  '代禱牆': ['代禱牆代碼', '標題', '標語', '經文', '說明', '排', '允許新增排', '色調', '開放', '建立者', '建立時間'],
  '代禱名單': ['紀錄代碼', '時間', '代禱牆代碼', '排', '名字', '填寫者', '填寫者 userId'],
  '發布者': ['LINE userId', '名稱', '備註'],
  '代禱卡': ['LINE userId', 'LINE名稱', '名單', '更新時間'],
  '參與紀錄': ['LINE userId', '代禱牆代碼', '最後開啟', '加入時間', 'LINE名稱', '角色'],
};

// 欄位位置（從 0 開始）
const W = { ID: 0, TITLE: 1, TAG: 2, VERSE: 3, DESC: 4, GROUPS: 5, ALLOW: 6, THEME: 7, OPEN: 8, CREATOR: 9, CREATED: 10 };
const N = { ID: 0, TIME: 1, WALL: 2, GROUP: 3, NAME: 4, BY: 5, UID: 6 };

const THEMES = ['pom', 'olive', 'leaf', 'sky', 'plum', 'amber', 'teal', 'navy', 'rose', 'earth'];
const LIMITS = { GROUPS: 40, GROUP_LEN: 20, NAME_LEN: 20, PER_SUBMIT: 30, TITLE: 40, TAG: 16, VERSE: 120, DESC: 300 };

/** 建立工作表並補齊標題列；更新程式後再執行一次也安全 */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEADERS).forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const h = HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  ss.getSheetByName(SH.NAMES).getRange('E:E').setNumberFormat('@'); // 名字一律當文字
  sessionSheet();
  const first = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

function doGet() {
  return json({ ok: true, msg: '代禱牆後端運作中' });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // 有平台自己的通行證就用通行證（60 天有效），否則向 LINE 驗證 ID token
    const user = req.session && req.action !== 'session' ? userFromSession(req.session) : verifyIdToken(req.idToken);
    const own = () => requireOwner(user, req.wallId); // 代禱牆建立者或管理員
    switch (req.action) {
      case 'session':     out = { ok: true, ...createSession(user) }; break;
      case 'logout':      deleteSession(req.session); out = { ok: true }; break;
      case 'me':          out = { ok: true, userId: user.userId, displayName: user.displayName, isAdmin: isPublisher(user.userId) }; break;
      case 'wall':        out = { ok: true, ...openWall(user, req.wallId) }; break;
      case 'joinWall':    out = { ok: true, wall: joinWall(user, req.wallId) }; break;
      case 'leaveWall':   out = { ok: true, ...leaveWall(user, req.wallId) }; break;
      case 'removeMembers': own(); out = { ok: true, wall: removeMembers(user, req.wallId, req.keys) }; break;
      case 'setMemberRole': own(); out = { ok: true, wall: setMemberRole(user, req.wallId, req.key, req.role) }; break;
      case 'addNames':    out = { ok: true, ...addNames(user, req.wallId, req.group, req.names, req.cardDay) }; break;
      case 'getCard':     out = { ok: true, ...getCard(user) }; break;
      case 'saveCard':    out = { ok: true, ...saveCard(user, req.card) }; break;
      case 'removeName':  out = { ok: true, wall: removeName(user, req.wallId, req.entryId) }; break;
      case 'createWall':  out = { ok: true, wall: createWall(user, req.wall || {}) }; break;
      case 'listWalls':   out = { ok: true, walls: listWalls(user) }; break;
      case 'updateWall':  own(); out = { ok: true, wall: updateWall(req.wallId, req.wall || {}, user) }; break;
      case 'setOpen':     own(); out = { ok: true, wall: setOpen(req.wallId, !!req.open, user) }; break;
      case 'deleteWall':  own(); out = { ok: true, removed: deleteWall(req.wallId) }; break;
      case 'deleteWalls': out = { ok: true, ...deleteWalls(user, req.wallIds) }; break;
      case 'setOpenMany': out = { ok: true, ...setOpenMany(user, req.wallIds, !!req.open) }; break;
      case 'removeNames': out = { ok: true, wall: removeNames(user, req.wallId, req.entryIds) }; break;
      case 'editName':    out = { ok: true, wall: editName(user, req.wallId, req.entryId, req.name, req.group) }; break;
      case 'moveNames':   own(); out = { ok: true, wall: moveNames(user, req.wallId, req.entryIds, req.group) }; break;
      case 'adminOverview': requirePublisher(user); out = { ok: true, ...adminOverview(user) }; break;
      case 'myData':      out = { ok: true, ...myData(user) }; break;
      case 'deleteMyData': out = { ok: true, ...deleteMyData(user) }; break;
      default: throw new Error('未知的動作');
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json(out);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 平台通行證：登入一次，60 天內不用再登入 ----------
   通行證存在隱藏的「登入」工作表，只有試算表擁有者看得到。 */
const SESSION_SHEET = '登入';
const SESSION_DAYS = 60;

function sessionSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SESSION_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SESSION_SHEET);
    sh.appendRow(['通行證', 'LINE userId', 'LINE名稱', '到期', '建立']);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

function createSession(user) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = new Date(), exp = new Date(now.getTime() + SESSION_DAYS * 864e5);
  withLock(() => {
    const sh = sessionSheet();
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) if (data[i][3] instanceof Date && data[i][3] < now) sh.deleteRow(i + 1); // 順手清掉過期的
    sh.appendRow([token, user.userId, user.displayName, exp, now]);
  });
  return { token, expires: exp.getTime() };
}

function userFromSession(token) {
  const data = sessionSheet().getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token && data[i][3] instanceof Date && data[i][3] > now) return { userId: String(data[i][1]), displayName: String(data[i][2]) };
  }
  throw new Error('SESSION_EXPIRED');
}

function deleteSession(token) {
  if (!token) return;
  withLock(() => {
    const sh = sessionSheet(), data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) if (data[i][0] === token) sh.deleteRow(i + 1);
  });
}

/** 向 LINE 驗證 ID token，防止有人偽造身分 */
function verifyIdToken(idToken) {
  if (!idToken) throw new Error('缺少登入資訊，請在 LINE 中重新開啟');
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: { id_token: idToken, client_id: CONFIG.CHANNEL_ID },
    muteHttpExceptions: true,
  });
  const d = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    const m = d.error_description || '驗證失敗';
    throw new Error(/expired/i.test(m) ? 'TOKEN_EXPIRED' : 'LINE 身分驗證失敗：' + m);
  }
  return { userId: d.sub, displayName: d.name || '' };
}

/* ---------- 工具 ---------- */
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows(name) { const v = sheet(name).getDataRange().getValues(); v.shift(); return v; }
function tz() { return Session.getScriptTimeZone(); }
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function fmt(d, pattern) { return d instanceof Date ? Utilities.formatDate(d, tz(), pattern || 'yyyy/MM/dd HH:mm') : String(d || ''); }
function parseJson(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }
function clip(v, n) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n); }
function clipText(v, n) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n); }
function newId(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- 權限 ---------- */
function isPublisher(uid) { return rows(SH.PUBLISHERS).some(r => String(r[0]).trim() === uid); }
function creatorOf(row) { const m = /\((U[0-9a-f]+)\)\s*$/.exec(String(row[W.CREATOR] || '')); return m ? m[1] : ''; }
function canManage(user, row) { return !!row && (creatorOf(row) === user.userId || isPublisher(user.userId) || memberOf(user.userId, String(row[W.ID])).role === 'admin'); }
function requireOwner(user, wallId) {
  const row = findWall(wallId).row;
  if (!canManage(user, row)) throw new Error('只有建立這面代禱牆的人可以管理');
}

/* ---------- 代禱牆 ---------- */
function findWall(id) {
  const sh = sheet(SH.WALLS), data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][W.ID]) === String(id)) return { sh, index: i + 1, row: data[i] };
  throw new Error('找不到這面代禱牆，可能已經被刪除');
}

function cleanTheme(v) { v = String(v || '').trim(); return THEMES.indexOf(v) >= 0 ? v : 'pom'; }

/** 排的清單：可以是文字，或 { name, from }（from＝改名前的名字） */
function cleanGroups(list) {
  const seen = {}, out = [];
  (Array.isArray(list) ? list : []).forEach(g => {
    const name = clip(typeof g === 'string' ? g : g && g.name, LIMITS.GROUP_LEN);
    if (!name || seen[name]) return;
    seen[name] = 1;
    out.push({ name, from: typeof g === 'object' && g && g.from ? clip(g.from, 60) : '' });
  });
  return out.slice(0, LIMITS.GROUPS);
}

function cleanWallInput(w) {
  const title = clip(w.title, LIMITS.TITLE);
  if (!title) throw new Error('請填寫代禱牆名稱');
  const groups = cleanGroups(w.groups);
  if (!groups.length && !isTrue(w.allowAdd)) throw new Error('請至少設定一個排，或開放成員自行新增排');
  return {
    title,
    tag: clip(w.tag, LIMITS.TAG),
    verse: clip(w.verse, LIMITS.VERSE),
    desc: clipText(w.desc, LIMITS.DESC),
    groups,
    allowAdd: isTrue(w.allowAdd),
    theme: cleanTheme(w.theme),
  };
}

function rowToWall(r) {
  return {
    id: String(r[W.ID]), title: String(r[W.TITLE]), tag: String(r[W.TAG] || ''), verse: String(r[W.VERSE] || ''),
    desc: String(r[W.DESC] || ''), groups: parseJson(r[W.GROUPS], []) || [], allowAdd: isTrue(r[W.ALLOW]),
    theme: cleanTheme(r[W.THEME]), open: r[W.OPEN] === '' ? true : isTrue(r[W.OPEN]),
    creator: String(r[W.CREATOR] || '').replace(/\s*\(U[0-9a-f]+\)\s*$/, ''), created: fmt(r[W.CREATED]),
  };
}

function namesOf(wallId) { return rows(SH.NAMES).filter(r => String(r[N.WALL]) === String(wallId)); }

/** 代禱牆畫面要的全部資料：各排名單、統計、自己填的可以刪 */
function buildView(row, user, nameRows) {
  const w = rowToWall(row);
  const manage = user ? canManage(user, row) : false;
  const byGroup = {};
  (nameRows || namesOf(w.id)).forEach(r => {
    const g = String(r[N.GROUP]);
    const e = { id: String(r[N.ID]), name: String(r[N.NAME]), mine: !!user && String(r[N.UID]) === user.userId };
    if (manage) { e.by = String(r[N.BY] || ''); e.time = fmt(r[N.TIME], 'M/d HH:mm'); } // 後台才看得到是誰填的
    (byGroup[g] = byGroup[g] || []).push(e);
  });
  const order = w.groups.slice();
  Object.keys(byGroup).forEach(g => { if (order.indexOf(g) < 0) order.push(g); }); // 舊資料或被移除的排仍顯示
  w.list = order.map(g => ({ name: g, names: byGroup[g] || [] }));
  w.total = w.list.reduce((s, g) => s + g.names.length, 0);
  w.filled = w.list.filter(g => g.names.length).length;
  w.unfilled = w.list.length - w.filled;
  w.canManage = manage;
  w.isCreator = !!user && creatorOf(row) === user.userId;
  if (manage) {
    w.members = membersOf(w.id).map(m => ({ key: m.uid, name: m.name, joined: m.joined, last: m.last, role: m.uid === creatorOf(row) ? 'owner' : m.role }));
    if (!w.members.some(m => m.key === creatorOf(row))) w.members.unshift({ key: creatorOf(row), name: w.creator, joined: w.created, last: '', role: 'owner' });
  }
  return w;
}

function wallView(id, user) { return buildView(findWall(id).row, user); }

function createWall(user, input) {
  const w = cleanWallInput(input);
  const id = newId('W');
  withLock(() => sheet(SH.WALLS).appendRow([id, w.title, w.tag, w.verse, w.desc, JSON.stringify(w.groups.map(g => g.name)), w.allowAdd, w.theme, true,
    `${user.displayName} (${user.userId})`, new Date()]));
  return wallView(id, user);
}

function updateWall(id, input, user) {
  const w = cleanWallInput(input);
  return withLock(() => {
    const f = findWall(id);
    const names = w.groups.map(g => g.name);
    // 改名：把原本那個排的名單一起搬過去；從清單移除的排，名單一起刪除
    const renames = {};
    w.groups.forEach(g => { if (g.from && g.from !== g.name) renames[g.from] = g.name; });
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][N.WALL]) !== String(id)) continue;
      const g = String(data[i][N.GROUP]);
      if (renames[g]) nsh.getRange(i + 1, N.GROUP + 1).setValue(renames[g]);
      else if (names.indexOf(g) < 0) nsh.deleteRow(i + 1);
    }
    f.sh.getRange(f.index, W.TITLE + 1, 1, 8).setValues([[w.title, w.tag, w.verse, w.desc, JSON.stringify(names), w.allowAdd, w.theme, f.row[W.OPEN] === '' ? true : f.row[W.OPEN]]]);
    return wallView(id, user);
  });
}

function setOpen(id, open, user) {
  const f = findWall(id);
  f.sh.getRange(f.index, W.OPEN + 1).setValue(open);
  return wallView(id, user);
}

function deleteWall(id) {
  return withLock(() => {
    const f = findWall(id);
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    let removed = 0;
    for (let i = data.length - 1; i >= 1; i--) if (String(data[i][N.WALL]) === String(id)) { nsh.deleteRow(i + 1); removed++; }
    f.sh.deleteRow(f.index);
    const js = joinedSheet(), jd = js.getDataRange().getValues();
    for (let i = jd.length - 1; i >= 1; i--) if (String(jd[i][1]) === String(id)) js.deleteRow(i + 1);
    JOINED_MEMO = null;
    return removed;
  });
}

/** 自己建立的代禱牆（管理員看得到全部），新的在前面 */
function listWalls(user) {
  const admin = isPublisher(user.userId);
  const all = rows(SH.NAMES);
  return rows(SH.WALLS)
    .filter(r => r[W.ID] && (admin || creatorOf(r) === user.userId || memberOf(user.userId, String(r[W.ID])).role === 'admin'))
    .map(r => {
      const v = buildView(r, user, all.filter(n => String(n[N.WALL]) === String(r[W.ID])));
      v.mine = creatorOf(r) === user.userId;
      return v;
    })
    .reverse();
}

/* ---------- 成員填名單 ---------- */
function cleanNames(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(/[\n,，、;；]+/);
  const seen = {}, out = [];
  arr.forEach(n => { n = clip(n, LIMITS.NAME_LEN); if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
  return out;
}

function addNames(user, wallId, group, list, cardDay) {
  group = clip(group, LIMITS.GROUP_LEN);
  if (!group) throw new Error('請先選擇你的排');
  const names = cleanNames(list);
  if (!names.length) throw new Error('請填入至少一位福音朋友的名字');
  if (names.length > LIMITS.PER_SUBMIT) throw new Error(`一次最多填 ${LIMITS.PER_SUBMIT} 位，請分次送出`);
  return withLock(() => {
    const f = findWall(wallId);
    const w = rowToWall(f.row);
    if (!w.open) throw new Error('這面代禱牆已經停止填寫');
    if (!canManage(user, f.row) && !memberOf(user.userId, wallId).row) throw new Error('請先加入這面代禱牆');
    if (w.groups.indexOf(group) < 0) {
      if (!w.allowAdd) throw new Error('沒有這個排，請從清單中選擇');
      if (w.groups.length >= LIMITS.GROUPS) throw new Error('排的數量已達上限');
      w.groups.push(group);
      f.sh.getRange(f.index, W.GROUPS + 1).setValue(JSON.stringify(w.groups));
      f.row[W.GROUPS] = JSON.stringify(w.groups);
    }
    const existing = namesOf(wallId).filter(r => String(r[N.GROUP]) === group).map(r => String(r[N.NAME]));
    const added = names.filter(n => existing.indexOf(n) < 0);
    const skipped = names.filter(n => existing.indexOf(n) >= 0);
    if (added.length) {
      const now = new Date(), by = user.displayName || '';
      const sh = sheet(SH.NAMES);
      sh.getRange(sh.getLastRow() + 1, 1, added.length, 7)
        .setValues(added.map(n => [newId('N'), now, wallId, group, n, by, user.userId]));
    }
    const res = { wall: buildView(f.row, user), group, added, skipped };
    // 同時加入自己的個人代禱卡（選了哪一天就放在那一天）
    if (cardDay !== undefined && cardDay !== null && cardDay !== '' && +cardDay >= 0 && +cardDay <= 6) res.cardAdded = mergeIntoCard(user, +cardDay, names);
    return res;
  });
}

function removeName(user, wallId, entryId) {
  return withLock(() => {
    const f = findWall(wallId);
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][N.ID]) !== String(entryId) || String(data[i][N.WALL]) !== String(wallId)) continue;
      if (String(data[i][N.UID]) !== user.userId && !canManage(user, f.row)) throw new Error('只能刪除自己填的名字');
      nsh.deleteRow(i + 1);
      break;
    }
    return buildView(f.row, user);
  });
}

/* ---------- 我的個人資料 ---------- */
function myData(user) {
  const titles = {};
  rows(SH.WALLS).forEach(r => { titles[String(r[W.ID])] = String(r[W.TITLE]); });
  const entries = rows(SH.NAMES).filter(r => String(r[N.UID]) === user.userId)
    .map(r => ({ wall: titles[String(r[N.WALL])] || '（已刪除）', group: String(r[N.GROUP]), name: String(r[N.NAME]), time: fmt(r[N.TIME], 'yyyy/MM/dd') }));
  const walls = rows(SH.WALLS).filter(r => creatorOf(r) === user.userId).map(r => String(r[W.TITLE]));
  const card = readCard(user.userId);
  const cardCount = card ? card.days.reduce((s, d) => s + d.names.length, 0) : 0;
  return { displayName: user.displayName, entries, walls, cardCount };
}

function deleteMyData(user) {
  return withLock(() => {
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    let entries = 0;
    for (let i = data.length - 1; i >= 1; i--) if (String(data[i][N.UID]) === user.userId) { nsh.deleteRow(i + 1); entries++; }
    [SH.CARDS, SH.JOINED].forEach(name => {
      const sh = sheet(name); if (!sh) return;
      const d = sh.getDataRange().getValues();
      for (let i = d.length - 1; i >= 1; i--) if (String(d[i][0]) === user.userId) sh.deleteRow(i + 1);
    });
    const ssh = sessionSheet(), sd = ssh.getDataRange().getValues();
    for (let i = sd.length - 1; i >= 1; i--) if (String(sd[i][1]) === user.userId) ssh.deleteRow(i + 1);
    return { entries };
  });
}

/* ---------- 個人代禱卡（每週七天、每天一個類別） ---------- */
const CARD_CATS = ['家人', '親戚', '好友', '同事(學)', '鄰居', '聖徒', '馬路'];
const CARD_MAX = 60; // 每天最多幾個名字

function cardSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.CARDS);
  if (!sh) { sh = ss.insertSheet(SH.CARDS); sh.appendRow(HEADERS[SH.CARDS]); sh.setFrozenRows(1); }
  return sh;
}
function blankCard() { return { days: CARD_CATS.map(cat => ({ cat, names: [] })) }; }
function cleanCard(c) {
  const out = blankCard();
  const days = c && Array.isArray(c.days) ? c.days : [];
  for (let i = 0; i < 7; i++) {
    const d = days[i] || {};
    out.days[i].cat = clip(d.cat, 8) || CARD_CATS[i];
    const seen = {};
    out.days[i].names = (Array.isArray(d.names) ? d.names : []).map(n => clip(n, LIMITS.NAME_LEN)).filter(n => n && !seen[n] && (seen[n] = 1)).slice(0, CARD_MAX);
  }
  return out;
}
function findCardRow(uid) {
  const sh = cardSheet(), data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === uid) return { sh, index: i + 1, row: data[i] };
  return { sh, index: 0, row: null };
}
function readCard(uid) { const f = findCardRow(uid); return f.row ? cleanCard(parseJson(f.row[2], null)) : null; }
function writeCard(user, card) {
  const f = findCardRow(user.userId), vals = [user.userId, user.displayName || '', JSON.stringify(card), new Date()];
  if (f.index) f.sh.getRange(f.index, 1, 1, 4).setValues([vals]); else f.sh.appendRow(vals);
}
function mergeIntoCard(user, day, names) {
  const card = readCard(user.userId) || blankCard();
  const list = card.days[day].names, added = [];
  names.forEach(n => { if (list.indexOf(n) < 0 && list.length < CARD_MAX) { list.push(n); added.push(n); } });
  if (added.length) writeCard(user, card);
  return { day, cat: card.days[day].cat, added };
}

/** 個人代禱卡＋我參與的代禱牆＋哪些名字已經放在代禱牆上 */
function getCard(user) {
  const card = readCard(user.userId) || blankCard();
  const titles = {}, wallRows = {};
  rows(SH.WALLS).forEach(r => { titles[String(r[W.ID])] = String(r[W.TITLE]); wallRows[String(r[W.ID])] = r; });
  const all = rows(SH.NAMES);
  const onWall = {};
  all.forEach(r => {
    if (String(r[N.UID]) !== user.userId) return;
    const wid = String(r[N.WALL]); if (!titles[wid]) return;
    const n = String(r[N.NAME]);
    (onWall[n] = onWall[n] || []).indexOf(titles[wid]) < 0 && onWall[n].push(titles[wid]);
  });
  const joined = joinedRows().slice(1).filter(r => String(r[0]) === user.userId).sort((a, b) => (b[2] || 0) - (a[2] || 0)).map(r => String(r[1]));
  const walls = joined.filter(id => wallRows[id]).slice(0, 30).map(id => {
    const v = buildView(wallRows[id], user, all.filter(n => String(n[N.WALL]) === id));
    v.mine = creatorOf(wallRows[id]) === user.userId;
    return v;
  });
  return { card, onWall, walls };
}

function saveCard(user, input) {
  const card = cleanCard(input);
  withLock(() => writeCard(user, card));
  return { card };
}

/* ---------- 代禱牆成員：只有建立者、總管理者和按「加入」的人看得到名單 ----------
   「參與紀錄」工作表：LINE userId、代禱牆代碼、最後開啟、加入時間、LINE名稱、角色（member／admin＝協助管理） */
let JOINED_MEMO = null;
function joinedSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.JOINED);
  if (!sh) { sh = ss.insertSheet(SH.JOINED); sh.setFrozenRows(1); }
  const h = HEADERS[SH.JOINED];
  if (sh.getLastColumn() < h.length) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  return sh;
}
function joinedRows() { return JOINED_MEMO || (JOINED_MEMO = joinedSheet().getDataRange().getValues()); }
function memberOf(uid, wallId) {
  const data = joinedRows();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === uid && String(data[i][1]) === String(wallId)) return { index: i + 1, row: data[i], role: String(data[i][5] || 'member') };
  return { index: 0, row: null, role: '' };
}
function membersOf(wallId) {
  return joinedRows().slice(1).filter(r => String(r[1]) === String(wallId))
    .map(r => ({ uid: String(r[0]), name: String(r[4] || ''), joined: fmt(r[3] || r[2], 'yyyy/M/d'), last: fmt(r[2], 'M/d HH:mm'), role: String(r[5] || 'member') }));
}
function touchMember(user, wallId) {
  try {
    const m = memberOf(user.userId, wallId); if (!m.index) return;
    joinedSheet().getRange(m.index, 3).setValue(new Date());
    if (user.displayName && String(m.row[4] || '') !== user.displayName) joinedSheet().getRange(m.index, 5).setValue(user.displayName);
  } catch (e) {}
}
/** 公開預覽：只有名稱、經文、各排人數，不含任何名字 */
function previewOf(row) {
  const w = buildView(row, null);
  w.list = w.list.map(g => ({ name: g.name, names: [], count: g.names.length }));
  w.preview = true;
  w.memberCount = membersOf(w.id).length;
  return w;
}
function openWall(user, wallId) {
  const f = findWall(wallId);
  if (canManage(user, f.row) || memberOf(user.userId, wallId).row) { touchMember(user, wallId); return { wall: buildView(f.row, user), joined: true }; }
  return { wall: previewOf(f.row), joined: false };
}
function joinWall(user, wallId) {
  return withLock(() => {
    const f = findWall(wallId);
    JOINED_MEMO = null;
    if (!memberOf(user.userId, wallId).row) { joinedSheet().appendRow([user.userId, wallId, new Date(), new Date(), user.displayName || '', 'member']); JOINED_MEMO = null; }
    return buildView(f.row, user);
  });
}
function leaveWall(user, wallId) {
  return withLock(() => {
    JOINED_MEMO = null;
    const m = memberOf(user.userId, wallId);
    if (m.index) joinedSheet().deleteRow(m.index);
    JOINED_MEMO = null;
    return { left: !!m.index };
  });
}
/** 後台：移除成員（不能移除建立者；協助管理的人不能移除其他協助管理者） */
function removeMembers(user, wallId, keys) {
  const set = {}; (Array.isArray(keys) ? keys : []).forEach(k => { set[String(k)] = 1; });
  return withLock(() => {
    const f = findWall(wallId), owner = creatorOf(f.row), boss = owner === user.userId || isPublisher(user.userId);
    const sh = joinedSheet(), data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      const uid = String(data[i][0]);
      if (String(data[i][1]) !== String(wallId) || !set[uid] || uid === owner) continue;
      if (!boss && String(data[i][5]) === 'admin') continue;
      sh.deleteRow(i + 1);
    }
    JOINED_MEMO = null;
    return buildView(f.row, user);
  });
}
/** 後台：設定角色（member 一般成員／admin 協助管理）；只有建立者或總管理者可以 */
function setMemberRole(user, wallId, key, role) {
  return withLock(() => {
    const f = findWall(wallId);
    if (creatorOf(f.row) !== user.userId && !isPublisher(user.userId)) throw new Error('只有建立者可以設定協助管理');
    JOINED_MEMO = null;
    const m = memberOf(String(key), wallId);
    if (!m.index) throw new Error('這個人已經不是成員');
    joinedSheet().getRange(m.index, 6).setValue(role === 'admin' ? 'admin' : 'member');
    JOINED_MEMO = null;
    return buildView(f.row, user);
  });
}

/* ---------- 後台：建立者管理自己的代禱牆；總管理者（「發布者」工作表）管理全部 ---------- */
function requirePublisher(user) { if (!isPublisher(user.userId)) throw new Error('只有總管理者可以使用這個功能'); }

function deleteWalls(user, ids) {
  ids = (Array.isArray(ids) ? ids : []).map(String);
  const done = [], skipped = [];
  ids.forEach(id => {
    try { const row = findWall(id).row; if (!canManage(user, row)) { skipped.push(id); return; } deleteWall(id); done.push(id); }
    catch (e) { skipped.push(id); }
  });
  return { deleted: done, skipped };
}

function setOpenMany(user, ids, open) {
  const done = [];
  (Array.isArray(ids) ? ids : []).map(String).forEach(id => {
    try { const f = findWall(id); if (canManage(user, f.row)) { f.sh.getRange(f.index, W.OPEN + 1).setValue(open); done.push(id); } } catch (e) {}
  });
  return { updated: done, open };
}

/** 一次刪除好幾個名字：建立者／總管理者可刪全部，一般人只能刪自己填的 */
function removeNames(user, wallId, entryIds) {
  const set = {}; (Array.isArray(entryIds) ? entryIds : []).forEach(id => { set[String(id)] = 1; });
  return withLock(() => {
    const f = findWall(wallId), manage = canManage(user, f.row);
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (!set[String(data[i][N.ID])] || String(data[i][N.WALL]) !== String(wallId)) continue;
      if (!manage && String(data[i][N.UID]) !== user.userId) continue;
      nsh.deleteRow(i + 1);
    }
    return buildView(f.row, user);
  });
}

/** 修改一個名字（也可以換到別的排）：建立者／總管理者，或填寫者本人 */
function editName(user, wallId, entryId, name, group) {
  name = clip(name, LIMITS.NAME_LEN);
  if (!name) throw new Error('名字不能空白');
  return withLock(() => {
    const f = findWall(wallId), w = rowToWall(f.row), manage = canManage(user, f.row);
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][N.ID]) !== String(entryId) || String(data[i][N.WALL]) !== String(wallId)) continue;
      if (!manage && String(data[i][N.UID]) !== user.userId) throw new Error('只能修改自己填的名字');
      let g = clip(group, LIMITS.GROUP_LEN) || String(data[i][N.GROUP]);
      if (w.groups.indexOf(g) < 0 && g !== String(data[i][N.GROUP])) {
        if (!manage && !w.allowAdd) throw new Error('沒有這個排');
        w.groups.push(g); f.sh.getRange(f.index, W.GROUPS + 1).setValue(JSON.stringify(w.groups)); f.row[W.GROUPS] = JSON.stringify(w.groups);
      }
      nsh.getRange(i + 1, N.GROUP + 1, 1, 2).setValues([[g, name]]);
      return buildView(f.row, user);
    }
    throw new Error('找不到這個名字，可能已經被刪除');
  });
}

/** 把好幾個名字移到另一個排（建立者／總管理者） */
function moveNames(user, wallId, entryIds, group) {
  group = clip(group, LIMITS.GROUP_LEN);
  if (!group) throw new Error('請選擇要移到哪一個排');
  const set = {}; (Array.isArray(entryIds) ? entryIds : []).forEach(id => { set[String(id)] = 1; });
  return withLock(() => {
    const f = findWall(wallId), w = rowToWall(f.row);
    if (w.groups.indexOf(group) < 0) { w.groups.push(group); f.sh.getRange(f.index, W.GROUPS + 1).setValue(JSON.stringify(w.groups)); f.row[W.GROUPS] = JSON.stringify(w.groups); }
    const nsh = sheet(SH.NAMES), data = nsh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) if (set[String(data[i][N.ID])] && String(data[i][N.WALL]) === String(wallId)) nsh.getRange(i + 1, N.GROUP + 1).setValue(group);
    return buildView(f.row, user);
  });
}

/** 總管理後台：全部代禱牆＋整體統計（個人代禱卡只算人數，不看內容） */
function adminOverview(user) {
  const names = rows(SH.NAMES), uids = {};
  names.forEach(r => { uids[String(r[N.UID])] = 1; });
  const cs = sheet(SH.CARDS), cards = cs ? rows(SH.CARDS) : [];
  let cardNames = 0;
  cards.forEach(r => { const c = parseJson(r[2], null); if (c && c.days) c.days.forEach(d => { cardNames += (d.names || []).length; }); });
  const walls = rows(SH.WALLS).filter(r => r[W.ID]).map(r => {
    const v = buildView(r, user, names.filter(n => String(n[N.WALL]) === String(r[W.ID])));
    v.mine = creatorOf(r) === user.userId;
    v.memberCount = membersOf(String(r[W.ID])).length;
    v.fillers = Object.keys(names.filter(n => String(n[N.WALL]) === String(r[W.ID])).reduce((o, n) => (o[String(n[N.UID])] = 1, o), {})).length;
    return v;
  }).reverse();
  return { walls, stats: { walls: walls.length, open: walls.filter(w => w.open).length, names: names.length, fillers: Object.keys(uids).length, cardUsers: cards.length, cardNames } };
}
