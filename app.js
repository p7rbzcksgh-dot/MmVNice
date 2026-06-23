(function(){
  'use strict';
  const E = window.MindMeltEngine;
  const STORE_KEY = 'mindmelt.beta.v1.store';
  const defaultStore = () => ({ inbox:[], calendar:[], tasks:[], ideas:[], recommendations:[], notes:[], brainDump:[], completions:[], settings:{ weeklyDay:'Sunday', weeklyTime:'7:00 PM', lastWeeklyMessageWeek:'', notificationsEnabled:false, notificationLeadMinutes:60, notified:{} } });
  let store = loadStore();
  let lastAction = null;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const focus = $('#focusArea');
  const input = $('#entryInput');
  const tickerMessages = [
    'One tiny next step is enough.',
    'You do not need to organize the thought before saving it.',
    'Capture first. Sort second. Breathe.',
    'Messy input is valid input.',
    'Your brain is not broken. The system needs to be kinder.',
    'Start smaller than feels impressive. That is how momentum begins.',
    'You can come back to this later. MindMelt saved it.'
  ];
  let tickerIndex = 0;

  function loadStore(){
    try { const base = defaultStore(); const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); const merged = Object.assign(base, saved); merged.settings = Object.assign(base.settings, saved.settings || {}); merged.settings.notified = merged.settings.notified || {}; merged.completions = saved.completions || []; return merged; }
    catch { return defaultStore(); }
  }
  function saveStore(){ localStorage.setItem(STORE_KEY, JSON.stringify(store)); updateCounts(); }
  function escapeHTML(str){ return String(str||'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function label(category){ return ({calendar:'Calendar', tasks:'Tasks', ideas:'Ideas', recommendations:'Recommendations', notes:'Notes', brainDump:'Brain Dump'})[category] || category; }
  function icon(category){ return ({calendar:'📅', tasks:'✓', ideas:'💡', recommendations:'☆', notes:'📝', brainDump:'🧠'})[category] || '✦'; }
  function colorClass(category){ return ({calendar:'ask', tasks:'review', ideas:'ask', recommendations:'ask', notes:'success', brainDump:'review'})[category] || 'ask'; }
  function updateCounts(){ ['calendar','tasks','ideas','recommendations','notes','brainDump'].forEach(cat=>{ const el = $(`#count-${cat}`); if(el) el.textContent = store[cat].length; }); updateCalendarDockDate(); }
  function setActive(view){ $$('.dock-item').forEach(b => b.classList.toggle('active', b.dataset.view === view)); }
  function addInbox(inbox){ store.inbox.unshift(inbox); if(store.inbox.length > 200) store.inbox.pop(); }
  function saveItem(item){ hydrateItem(item); store[item.category].unshift(item); }
  function deleteItem(category, id){ store[category] = store[category].filter(i => i.id !== id); saveStore(); renderView(category); }
  function moveItem(from, id, to){ const item = store[from].find(i=>i.id===id); if(!item) return; store[from] = store[from].filter(i=>i.id!==id); item.category = to; store[to].unshift(item); saveStore(); renderView(to); }
  function allCategories(){ return ['calendar','tasks','ideas','recommendations','notes','brainDump']; }
  function findItemById(id){
    for(const cat of allCategories()){
      const item = (store[cat] || []).find(i => i.id === id);
      if(item) return { item, category:cat };
    }
    return null;
  }

  function timeRangeDisplay(item){
    const start = item?.time || '';
    const end = item?.endTime || '';
    if(start && end) return `${start}–${end}`;
    if(start) return start;
    return 'Time not set';
  }
  function itemNeedsTime(item){
    return !!item && !item.done && !item.time && (item.category === 'calendar' || item.date || item.dateKey || parseItemDateKey(item));
  }
  function renderSetTimePrompt(item){
    if(!itemNeedsTime(item)) return '';
    return `<div class="result-card ask" style="margin-top:14px"><h3>What time does it start?</h3><p class="meta">This item is on the calendar but the time is not set yet. Add a start and optional end time so reminders and calendar checks work better.</p><div class="confirm-row"><button class="pill" data-set-time="${item.id}">Set start / end time</button></div></div>`;
  }
  function renderTimeSetter(id){
    const found = findItemById(id);
    if(!found) return;
    const { item, category } = found;
    const key = item.dateKey || parseItemDateKey(item);
    const dateText = key ? dateKeyDisplay(key) : (item.date || 'Date not set');
    setActive(category === 'calendar' ? 'calendar' : '');
    focus.innerHTML = `<div class="panel-head"><h2>Set the time</h2><p class="muted">${escapeHTML(item.title)} • ${escapeHTML(dateText)}</p></div>
      <div class="result-card ask time-setter-card"><div class="time-helper">No stress — just add the start time. End time is optional, but it helps MindMelt understand your day better.</div>
      <div class="time-form-grid"><label>Start time<input id="timeStartInput" type="text" placeholder="Example: 5pm" value="${escapeHTML(item.time || '')}" /></label><label>End time optional<input id="timeEndInput" type="text" placeholder="Example: 7pm" value="${escapeHTML(item.endTime || '')}" /></label></div>
      <div class="confirm-row"><button class="pill" id="saveTimeButton">Save time</button><button class="pill" id="clearTimeButton">Clear time</button><button class="pill" id="cancelTimeButton">Back</button></div></div>`;
    $('#saveTimeButton')?.addEventListener('click',()=>{
      const start = ($('#timeStartInput')?.value || '').trim();
      const end = ($('#timeEndInput')?.value || '').trim();
      if(!start){ alert('Please enter a start time first. Example: 5pm'); return; }
      item.time = normalizeTimeText(start);
      item.endTime = end ? normalizeTimeText(end) : '';
      hydrateItem(item);
      saveStore();
      renderTimeSaved(item, category);
    });
    $('#clearTimeButton')?.addEventListener('click',()=>{ item.time=''; item.endTime=''; saveStore(); renderTimeSetter(id); });
    $('#cancelTimeButton')?.addEventListener('click',()=>{ if(currentDayKey) renderDayDetail(currentDayKey); else renderView(category); });
  }
  function normalizeTimeText(text){
    const mins = parseTimeMinutes(text);
    return mins == null ? text : formatMinutes(mins);
  }
  function renderTimeSaved(item, category){
    focus.innerHTML = `<div class="result-card success"><p class="result-title"><span>⏰</span><span>Time saved</span></p><div class="big-text">${escapeHTML(timeRangeDisplay(item))}</div><p class="meta">${escapeHTML(item.title)} now has a time attached. Calendar checks and reminders will use this start time.</p><div class="confirm-row"><button class="pill" data-view="calendar">Open Calendar</button><button class="pill" data-view="${category}">Open ${escapeHTML(label(category))}</button></div></div>`;
    focus.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click', e=>renderView(e.currentTarget.dataset.view)));
  }

  function hydrateItem(item){
    if(!item) return item;
    if(!item.dateKey){
      const key = parseItemDateKey(item);
      if(key) item.dateKey = key;
    }
    return item;
  }
  function hydrateStoreDates(){
    let changed = false;
    allCategories().forEach(cat => {
      (store[cat] || []).forEach(item => {
        if(!item.dateKey){
          const key = parseItemDateKey(item);
          if(key){ item.dateKey = key; changed = true; }
        }
      });
    });
    if(changed) saveStore();
  }
  function refreshDateKeysForCalendar(){
    // Calendar counts must always be calculated from the latest saved data.
    // This repairs older beta entries that were saved before dateKey existed,
    // without changing valid fixed dates already saved on purpose.
    let changed = false;
    allCategories().forEach(cat => {
      (store[cat] || []).forEach(item => {
        const parsed = parseItemDateKey(item);
        if(parsed && item.dateKey !== parsed && (!item.dateKey || isRelativeDateText(item.date || item.raw || item.title))){
          item.dateKey = parsed;
          changed = true;
        }
      });
    });
    if(changed) localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }
  function isRelativeDateText(text){
    return /\b(today|tonight|tomorrow|tmrw|this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(String(text || ''));
  }
  function resolvedDateKeyFromText(text){
    return parseItemDateKey({ date:'', raw:text, title:text });
  }
  function dateKeyDisplay(key){
    if(!key) return '';
    const d = new Date(key + 'T12:00:00');
    if(Number.isNaN(d.getTime())) return key;
    return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function updateCalendarDockDate(){
    const iconEl = document.querySelector('[data-view="calendar"] .dock-icon');
    if(iconEl){ iconEl.textContent = String(new Date().getDate()); iconEl.classList.add('calendar-date-icon'); }
  }
  function toggleDone(id){
    const found = findItemById(id);
    if(!found) return;
    const { item, category } = found;
    item.done = !item.done;
    if(item.done){
      item.completedAt = new Date().toISOString();
      store.completions = store.completions || [];
      store.completions.unshift({ id:'done_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8), itemId:item.id, title:item.title, category, completedAt:item.completedAt });
    } else {
      item.completedAt = '';
      store.completions = (store.completions || []).filter(c => c.itemId !== item.id);
    }
    saveStore();
    if(currentDayKey) renderDayDetail(currentDayKey); else renderView(category);
  }
  function undoLast(){
    if(!lastAction) return;
    if(lastAction.type === 'add'){
      lastAction.items.forEach(item => { store[item.category] = store[item.category].filter(i => i.id !== item.id); });
      store.inbox = store.inbox.filter(i => i.id !== lastAction.inboxId);
      lastAction = null; saveStore(); renderIdle('Undone. The last capture was removed.');
    }
  }



  let pendingAvailability = null;

  function parseDayLabel(text){
    const t = String(text || '').toLowerCase();
    const days = ['today','tonight','tomorrow','monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    for(const d of days){ if(t.includes(d)) return d === 'tonight' ? 'today' : d; }
    const month = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b/i);
    if(month) return month[0].toLowerCase();
    const slash = t.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/);
    return slash ? slash[0].toLowerCase() : '';
  }
  function parseTimeMinutes(text){
    const t = String(text || '').toLowerCase();
    let m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    if(m){
      let h = Number(m[1]); const min = Number(m[2] || 0); const ap = m[3];
      if(ap === 'pm' && h < 12) h += 12;
      if(ap === 'am' && h === 12) h = 0;
      return h * 60 + min;
    }
    m = t.match(/\b(?:at|around|by|before|after)\s+(\d{1,2})(?::(\d{2}))?\b/);
    if(m){
      let h = Number(m[1]); const min = Number(m[2] || 0);
      if(/\b(dinner|supper|evening|tonight|after work|practice)\b/.test(t) && h < 12) h += 12;
      return h * 60 + min;
    }
    return null;
  }
  function formatMinutes(minutes){
    minutes = ((minutes % 1440) + 1440) % 1440;
    const h24 = Math.floor(minutes / 60);
    const min = minutes % 60;
    const ap = h24 >= 12 ? 'PM' : 'AM';
    let h = h24 % 12; if(h === 0) h = 12;
    return `${h}:${String(min).padStart(2,'0')} ${ap}`;
  }
  function sameDayEvents(dayOrKey){
    if(!dayOrKey) return [];
    const targetKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dayOrKey)) ? String(dayOrKey) : resolvedDateKeyFromText(dayOrKey);
    const targetLabel = String(dayOrKey).toLowerCase();
    return (store.calendar || [])
      .map(item => Object.assign({}, item, {
        category:'calendar',
        dateKey: item.dateKey || parseItemDateKey(item),
        minute: parseTimeMinutes(`${item.time || ''} ${item.raw || ''}`)
      }))
      .filter(item => {
        if(targetKey && item.dateKey === targetKey) return true;
        return parseDayLabel(item.date || item.raw || item.title) === targetLabel;
      })
      .sort((a,b)=>(a.minute ?? 9999) - (b.minute ?? 9999));
  }
  function isPlanAvailabilityQuestion(query){
    return /\b(do i have|am i free|anything|plans|available|busy|free)\b/i.test(query) && (parseDayLabel(query) || parseTimeMinutes(query) !== null);
  }
  function findAvailability(day, afterMinute, rejected){
    const rejectedKeys = new Set(rejected || []);
    const events = sameDayEvents(day);
    const busy = new Set(events.map(e => e.minute).filter(v => v !== null));
    const slots = [9*60,10*60,11*60,12*60,13*60,14*60,15*60,16*60,17*60,18*60,19*60,20*60];
    const start = afterMinute == null ? 9*60 : afterMinute;
    const ordered = slots.filter(s=>s>=start).concat(slots.filter(s=>s<start));
    for(const slot of ordered){
      const key = `${day}|${slot}`;
      if(!busy.has(slot) && !rejectedKeys.has(key)) return { date:day, minute:slot, time:formatMinutes(slot), key };
    }
    return null;
  }
  function renderAvailabilityAsk(result){
    const query = result.query;
    const requestedKey = resolvedDateKeyFromText(query);
    const day = requestedKey || parseDayLabel(query) || 'today';
    const requestedMinute = parseTimeMinutes(query);
    const events = sameDayEvents(day);
    const dayText = requestedKey ? dateKeyDisplay(requestedKey) : day;

    if(requestedMinute == null){
      focus.innerHTML = `<div class="panel-head"><h2>Calendar Check</h2><p class="muted">${events.length ? `You have ${events.length} saved item${events.length===1?'':'s'} on ${escapeHTML(dayText)}.` : `I don’t see anything scheduled on ${escapeHTML(dayText)}.`}</p></div>
        ${events.length ? `<div class="result-card ask"><h3>Plans for ${escapeHTML(dayText)}</h3>${events.map(e=>renderCalendarLine(e)).join('')}</div>` : `<div class="result-card success"><h3>That day looks open.</h3><p class="meta">I checked saved calendar events for ${escapeHTML(dayText)} and did not find anything yet.</p></div>`}
        <div class="result-card success"><h3>Don’t stress — we’ll make this happen.</h3><p class="meta">If you are trying to plan something, it’s okay to choose another day so you don’t overload yourself. Ask me for a specific time, like “Do I have plans at 5pm Saturday?” and I’ll show what is before and after.</p></div>`;
      bindItemActions();
      return;
    }

    const before = events.filter(e => e.minute !== null && e.minute < requestedMinute);
    const after = events.filter(e => e.minute !== null && e.minute > requestedMinute);
    const exact = events.filter(e => e.minute === requestedMinute);
    const suggestion = findAvailability(day, requestedMinute + 60, []);
    pendingAvailability = { query, day, rejected:[], suggestion };
    const requestedText = `${formatMinutes(requestedMinute)} on ${dayText}`;
    const statusText = exact.length
      ? `You do have something at ${requestedText}.`
      : `You don’t have plans at ${requestedText}.`;
    const nearby = [
      ...before.slice(-2).map(e=>({label:'Before', item:e})),
      ...after.slice(0,2).map(e=>({label:'After', item:e}))
    ];
    focus.innerHTML = `<div class="panel-head"><h2>Calendar Check</h2><p class="muted">${escapeHTML(statusText)}</p></div>
      ${exact.length ? `<div class="result-card review"><h3>At that time</h3>${exact.map(e=>renderCalendarLine(e)).join('')}</div>` : ''}
      ${nearby.length ? `<div class="result-card ask"><h3>Same-day events around that time</h3>${nearby.map(x=>`<p class="calendar-line"><strong>${escapeHTML(x.label)}:</strong> ${escapeHTML(timeRangeDisplay(x.item))} — ${escapeHTML(x.item.title)}${itemNeedsTime(x.item) ? ` <button class="tiny-btn" data-set-time="${x.item.id}">Set time</button>` : ''}</p>`).join('')}</div>` : `<div class="result-card success"><h3>Same-day calendar looks clear.</h3><p class="meta">I didn’t find saved calendar events before or after ${escapeHTML(requestedText)}.</p></div>`}
      <div class="result-card success"><h3>Don’t stress — we’ll make this happen.</h3><p class="meta">It’s okay to plan this for another day so you don’t overwhelm yourself. Here is your upcoming availability. I’ll give you one date and time at a time, and you can accept it or reject it.</p>
      ${suggestion ? `<div class="big-text">Try ${escapeHTML(suggestion.time)} on ${escapeHTML(suggestion.date && /^\d{4}-/.test(suggestion.date) ? dateKeyDisplay(suggestion.date) : suggestion.date)}</div><div class="confirm-row"><button class="pill" id="acceptAvailability">Accept this time</button><button class="pill" id="rejectAvailability">Show another option</button></div>` : `<p class="meta">I couldn’t find an open slot for that day. Try asking for another day.</p>`}</div>`;
    bindAvailabilityButtons();
    bindItemActions();
  }
  function renderCalendarLine(item){
    const needs = itemNeedsTime(item);
    return `<p class="calendar-line"><strong>${escapeHTML(timeRangeDisplay(item))}</strong> — ${escapeHTML(item.title)}${needs ? ` <button class="tiny-btn" data-set-time="${item.id}">Set time</button>` : ''}</p>`;
  }
  function bindAvailabilityButtons(){
    $('#acceptAvailability')?.addEventListener('click', acceptAvailability);
    $('#rejectAvailability')?.addEventListener('click', rejectAvailability);
  }
  function acceptAvailability(){
    if(!pendingAvailability?.suggestion) return;
    const slot = pendingAvailability.suggestion;
    const item = {
      id: 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8),
      raw: pendingAvailability.query,
      title: 'Planned appointment',
      category: 'calendar',
      intent: 'capture',
      confidence: 'review',
      date: slot.date && /^\d{4}-/.test(slot.date) ? dateKeyDisplay(slot.date) : slot.date,
      dateKey: slot.date && /^\d{4}-/.test(slot.date) ? slot.date : resolvedDateKeyFromText(slot.date),
      time: slot.time,
      createdAt: new Date().toISOString(),
      done: false
    };
    store.calendar.unshift(item);
    lastAction = { type:'add', inboxId:null, items:[item] };
    saveStore();
    focus.innerHTML = `<div class="result-card success"><p class="result-title"><span>📅</span><span>Time saved</span></p><div class="big-text">${escapeHTML(slot.time)} on ${escapeHTML(slot.date && /^\d{4}-/.test(slot.date) ? dateKeyDisplay(slot.date) : slot.date)}</div><p class="meta">Saved as “Planned appointment.” You can rename it later from Calendar.</p><div class="confirm-row"><button class="pill" data-view="calendar">Open Calendar</button><button class="pill" id="undoBtn">Undo</button></div></div>`;
    $('#undoBtn')?.addEventListener('click', undoLast);
    focus.querySelector('[data-view]')?.addEventListener('click', e=>renderView(e.currentTarget.dataset.view));
  }
  function rejectAvailability(){
    if(!pendingAvailability?.suggestion) return;
    pendingAvailability.rejected.push(pendingAvailability.suggestion.key);
    const requestedMinute = parseTimeMinutes(pendingAvailability.query);
    const next = findAvailability(pendingAvailability.day, requestedMinute == null ? null : requestedMinute + 60, pendingAvailability.rejected);
    pendingAvailability.suggestion = next;
    if(!next){
      focus.querySelector('.result-card.success').innerHTML = `<h3>No more obvious openings on ${escapeHTML(pendingAvailability.day)}.</h3><p class="meta">Try another day, or open Calendar and choose manually. No stress — we can still make this happen.</p>`;
      return;
    }
    const big = focus.querySelector('.result-card.success .big-text');
    if(big) big.textContent = `Try ${next.time} on ${next.date}`;
  }

  function renderIdle(message){
    setActive('');
    focus.innerHTML = `<div class="focus-empty"><div class="spark">✦</div><h2>${escapeHTML(message || 'Your Mind. Organized.')}</h2><p>Enter something above and I’ll take care of the rest.</p><div class="quick-examples"><button data-example="Need cat food tomorrow">Need cat food tomorrow</button><button data-example="Do I have plans tonight?">Do I have plans tonight?</button><button data-example="Melt it: call Dan, buy cat food, schedule dentist, watch Dune Part Two">Melt it</button></div></div>`;
    bindExamples();
  }
  function renderCapture(result){
    const item = result.actions[0];
    const state = item.confidence === 'auto' ? 'success' : item.confidence === 'review' ? 'review' : 'ask';
    const detail = item.category === 'calendar' ? `${item.date || 'Date needs review'} ${item.time || ''}`.trim() : `Saved to ${label(item.category)}`;
    const review = item.confidence !== 'auto' ? renderClarify(item) : '';
    const timePrompt = renderSetTimePrompt(item);
    focus.innerHTML = `<div class="result-card ${state}"><p class="result-title"><span>${icon(item.category)}</span><span>${item.confidence === 'auto' ? 'Captured' : 'Captured for review'}</span></p><div class="big-text">${escapeHTML(item.title)}</div><p class="meta">${escapeHTML(detail)}</p><div class="confirm-row"><button class="pill" data-view="${item.category}">Open ${label(item.category)}</button><button class="pill" id="undoBtn">Undo</button></div>${review}${timePrompt}</div>`;
    $('#undoBtn')?.addEventListener('click', undoLast);
    focus.querySelector('[data-view]')?.addEventListener('click', e=>renderView(e.currentTarget.dataset.view));
    bindMoveButtons();
    bindItemActions();
  }
  function renderClarify(item){
    const choices = ['calendar','tasks','ideas','recommendations','notes','brainDump'].filter(c=>c!==item.category);
    return `<div class="result-card review" style="margin-top:14px"><h3>Need a different home?</h3><div class="confirm-row">${choices.map(c=>`<button class="choice" data-move-from="${item.category}" data-move-id="${item.id}" data-move-to="${c}">${icon(c)} ${label(c)}</button>`).join('')}</div></div>`;
  }
  function renderMelt(result){
    const groups = {};
    result.actions.forEach(item => { (groups[item.category] ||= []).push(item); });
    focus.innerHTML = `<div class="panel-head"><h2>Melt It sorted your brain dump.</h2><p class="muted">${result.actions.length} thoughts captured. Nothing was lost; uncertain items stay safe in Brain Dump.</p></div><div class="grid two">${Object.keys(groups).map(cat => `<div class="route-card"><h3>${icon(cat)} ${label(cat)}</h3><ul>${groups[cat].map(i=>`<li>${escapeHTML(i.title)}</li>`).join('')}</ul></div>`).join('')}</div><div class="confirm-row"><button class="pill" id="undoBtn">Undo sort</button><button class="pill" data-view="brainDump">Review Brain Dump</button></div>`;
    $('#undoBtn')?.addEventListener('click', undoLast);
    focus.querySelector('[data-view]')?.addEventListener('click', e=>renderView(e.currentTarget.dataset.view));
  }
  function renderAsk(result){
    if(isPlanAvailabilityQuestion(result.query)){ renderAvailabilityAsk(result); return; }
    const matches = E.searchData(result.query, store);
    focus.innerHTML = `<div class="panel-head"><h2>Ask Your Brain</h2><p class="muted">Search result for: “${escapeHTML(result.query)}”</p></div>${matches.length ? `<div class="grid two">${matches.map(renderItemCard).join('')}</div>` : `<div class="empty-list"><h3>No saved matches yet.</h3><p>MindMelt can only search what has already been captured in this beta.</p></div>`}`;
  }
  function renderBored(){
    focus.innerHTML = `<div class="panel-head"><h2>Boredom Busters</h2><p class="muted">Pick the kind of energy you want. MindMelt keeps the choice small on purpose.</p></div><div class="grid three"><div class="route-card"><h3>Productive</h3><ul><li>Clear one visible surface</li><li>Reply to one easy message</li><li>Pick one task and make it smaller</li></ul></div><div class="route-card"><h3>Fun</h3><ul><li>Open a saved recommendation</li><li>Play one song</li><li>Watch one short video</li></ul></div><div class="route-card"><h3>Quick dopamine</h3><ul><li>5-minute walk</li><li>Cold water reset</li><li>Text someone a meme</li></ul></div></div>`;
  }
  function renderStuck(result){
    focus.innerHTML = `<div class="result-card review"><p class="result-title"><span>🧩</span><span>Let's make it smaller.</span></p><div class="big-text">${escapeHTML(result.firstStep)}</div><p class="meta">This is support only, not therapy or medical advice. The goal is to reduce friction and help you start gently.</p><div class="confirm-row"><button class="pill" data-example="${escapeHTML(result.firstStep)}">Save this as a task</button></div></div>`;
    bindExamples();
  }

  let calendarCursor = new Date();
  let currentDayKey = '';
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const planningHorizonYears = 5;
  function maxPlanningDate(){ const d = new Date(); d.setFullYear(d.getFullYear()+planningHorizonYears); return d; }
  function pad(n){ return String(n).padStart(2,'0'); }
  function dateKey(date){ return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
  function startOfDay(date){ return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  function startOfWeek(date){ const d=startOfDay(date); d.setDate(d.getDate()-d.getDay()); return d; }
  function endOfWeek(date){ const d=startOfWeek(date); d.setDate(d.getDate()+6); d.setHours(23,59,59,999); return d; }
  function parseItemDateKey(item){
    if(item && item.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey)) return item.dateKey;
    const raw = String(`${item.date || ''} ${item.raw || ''} ${item.title || ''}`).toLowerCase();
    const today = startOfDay(new Date());
    if(/\btoday\b|\btonight\b/.test(raw)) return dateKey(today);
    if(/\btomorrow\b|\btmrw\b/.test(raw)){ const d=new Date(today); d.setDate(d.getDate()+1); return dateKey(d); }
    const slash = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if(slash){ const y = slash[3] ? Number(slash[3].length===2 ? '20'+slash[3] : slash[3]) : today.getFullYear(); return `${y}-${pad(Number(slash[1]))}-${pad(Number(slash[2]))}`; }
    const monthMap={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
    const m = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
    if(m){ const mo = monthMap[m[1].toLowerCase()]; let y = m[3] ? Number(m[3]) : today.getFullYear(); const d = new Date(y, mo, Number(m[2])); if(!m[3] && d < today && !raw.includes(String(y))) y++; return `${y}-${pad(mo+1)}-${pad(Number(m[2]))}`; }
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    for(let i=0;i<weekdays.length;i++){
      if(raw.includes(weekdays[i])){
        const d=new Date(today);
        let diff=(i-d.getDay()+7)%7;
        // Plain weekday means the closest upcoming occurrence, including today.
        // “next Thursday” means skip to the following week.
        if(new RegExp('\\bnext\\s+'+weekdays[i]+'\\b').test(raw)){ diff = diff === 0 ? 7 : diff + 7; }
        if(new RegExp('\\blast\\s+'+weekdays[i]+'\\b').test(raw)){ diff = diff === 0 ? -7 : diff - 7; }
        d.setDate(d.getDate()+diff);
        return dateKey(d);
      }
    }
    return '';
  }
  function attentionItemsForDate(key){
    const items = [];
    allCategories().forEach(cat => {
      (store[cat] || []).forEach(item => {
        const parsed = item.dateKey || parseItemDateKey(item);
        if(parsed === key && !item.done) items.push(Object.assign({}, item, { category:cat, dateKey:parsed }));
      });
    });
    return items.sort((a,b) => (parseTimeMinutes(`${a.time||''} ${a.raw||''}`) ?? 9999) - (parseTimeMinutes(`${b.time||''} ${b.raw||''}`) ?? 9999));
  }
  function allItemsForDate(key){
    const items = [];
    allCategories().forEach(cat => {
      (store[cat] || []).forEach(item => {
        const parsed = item.dateKey || parseItemDateKey(item);
        if(parsed === key) items.push(Object.assign({}, item, { category:cat, dateKey:parsed }));
      });
    });
    return items.sort((a,b) => (parseTimeMinutes(`${a.time||''} ${a.raw||''}`) ?? 9999) - (parseTimeMinutes(`${b.time||''} ${b.raw||''}`) ?? 9999));
  }
  function completedThisWeek(){
    const start = startOfWeek(new Date()); const end = endOfWeek(new Date());
    return (store.completions || []).filter(c => { const d=new Date(c.completedAt); return d>=start && d<=end; });
  }
  function renderMonthCalendar(){
    refreshDateKeysForCalendar();
    currentDayKey = '';
    setActive('calendar');
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.getMonth();
    const first = new Date(y,m,1);
    const last = new Date(y,m+1,0);
    const days = [];
    for(let i=0;i<first.getDay();i++) days.push(null);
    for(let d=1; d<=last.getDate(); d++) days.push(new Date(y,m,d));
    while(days.length % 7) days.push(null);
    const totalAttention = days.filter(Boolean).reduce((sum,d)=>sum+attentionItemsForDate(dateKey(d)).length,0);
    focus.innerHTML = `<div class="category-title"><div><h2>📅 ${monthNames[m]} ${y}</h2><p class="muted">Full month view. Each day shows open items needing attention. Future planning supports at least ${planningHorizonYears} years ahead.</p></div><div class="confirm-row"><button class="pill" id="prevMonth">← Previous</button><button class="pill" id="todayMonth">Today</button><button class="pill" id="nextMonth">Next →</button><button class="pill" id="nextYear">+1 year</button><button class="pill" id="fiveYearView">+5 years</button></div></div>
      <div class="calendar-weekdays">${dayNames.map(d=>`<span>${d}</span>`).join('')}</div>
      <div class="month-grid">${days.map(d=>{
        if(!d) return '<div class="day-card empty"></div>';
        const key = dateKey(d); const dayItems = attentionItemsForDate(key); const count = dayItems.length; const isToday = key === dateKey(new Date());
        const title = count ? dayItems.slice(0,5).map(i=>i.title).join(', ') : 'No open items';
        return `<button class="day-card ${isToday?'today':''}" data-day="${key}" title="${escapeHTML(title)}" aria-label="${escapeHTML(dateKeyDisplay(key))}: ${count} open item${count===1?'':'s'}"><span class="day-num">${d.getDate()}</span>${count ? `<span class="attention-count">${count}</span><span class="attention-label">open</span>` : `<span class="no-attention">0</span>`}</button>`;
      }).join('')}</div>
      <div class="weekly-summary-card"><div><h3>Weekly productivity update</h3><p class="meta">Message day: <strong>${escapeHTML(store.settings.weeklyDay)}</strong> at <strong>${escapeHTML(store.settings.weeklyTime)}</strong>. This beta shows the update in-app when opened.</p><p class="meta">Open items this month: ${totalAttention}. Completed this week: ${completedThisWeek().length}.</p></div><div class="confirm-row"><button class="pill" id="showWeeklyReport">Preview weekly update</button><button class="pill" id="weeklySettings">Change message day</button></div></div>`;
    $('#prevMonth')?.addEventListener('click',()=>{ calendarCursor = new Date(y,m-1,1); renderMonthCalendar(); });
    $('#nextMonth')?.addEventListener('click',()=>{ calendarCursor = new Date(y,m+1,1); renderMonthCalendar(); });
    $('#nextYear')?.addEventListener('click',()=>{ calendarCursor = new Date(y+1,m,1); renderMonthCalendar(); });
    $('#fiveYearView')?.addEventListener('click',()=>{ const d=maxPlanningDate(); calendarCursor = new Date(d.getFullYear(), d.getMonth(), 1); renderMonthCalendar(); });
    $('#todayMonth')?.addEventListener('click',()=>{ calendarCursor = new Date(); renderMonthCalendar(); });
    $$('[data-day]').forEach(b=>b.addEventListener('click',()=>renderDayDetail(b.dataset.day)));
    $('#showWeeklyReport')?.addEventListener('click',renderWeeklyReport);
    $('#weeklySettings')?.addEventListener('click',renderWeeklySettings);
  }
  function renderDayDetail(key){
    currentDayKey = key;
    setActive('calendar');
    const d = new Date(key+'T12:00:00');
    refreshDateKeysForCalendar();
    const items = allItemsForDate(key);
    const openCount = items.filter(i=>!i.done).length;
    focus.innerHTML = `<div class="category-title"><div><h2>📅 ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</h2><p class="muted">${items.length ? `${openCount} open item${openCount===1?'':'s'} needing attention. ${items.length-openCount} completed item${items.length-openCount===1?'':'s'} shown for context.` : 'Nothing saved for this day yet.'}</p></div><div class="confirm-row"><button class="pill" id="backCalendar">Month view</button><button class="pill" id="addForDay">Add something here</button></div></div>
      ${items.length ? `<div class="grid two">${items.map(renderItemCard).join('')}</div>` : `<div class="empty-list"><h3>This day is clear.</h3><p>Nice. You can leave it open or add something when you're ready.</p></div>`}`;
    $('#backCalendar')?.addEventListener('click',renderMonthCalendar);
    $('#addForDay')?.addEventListener('click',()=>{ input.value = `New item ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; input.focus(); });
    bindItemActions();
  }
  function renderWeeklySettings(){
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    focus.innerHTML = `<div class="panel-head"><h2>Weekly productivity update</h2><p class="muted">Pick the night MindMelt should show your weekly encouragement message.</p></div><div class="result-card ask settings-panel"><label>Message day<select id="weeklyDaySelect">${days.map(d=>`<option ${d===store.settings.weeklyDay?'selected':''}>${d}</option>`).join('')}</select></label><label>Message time<input id="weeklyTimeInput" value="${escapeHTML(store.settings.weeklyTime)}" /></label><div class="confirm-row"><button class="pill" id="saveWeeklySettings">Save update settings</button><button class="pill" id="backCalendar">Back to Calendar</button></div></div>`;
    $('#saveWeeklySettings')?.addEventListener('click',()=>{ store.settings.weeklyDay = $('#weeklyDaySelect').value; store.settings.weeklyTime = $('#weeklyTimeInput').value || '7:00 PM'; saveStore(); renderMonthCalendar(); });
    $('#backCalendar')?.addEventListener('click',renderMonthCalendar);
  }
  function renderWeeklyReport(){
    const completed = completedThisWeek();
    const open = allCategories().flatMap(cat => store[cat] || []).filter(i => !i.done && parseItemDateKey(i));
    const strong = completed.length >= 5;
    const message = strong
      ? 'You kicked ass and took names this week. Look at the proof below — you showed up, finished things, and kept moving.'
      : 'This week may have been lighter, and that is still okay. You are not behind forever. Let’s gently get you back in the driver’s seat with one small next step.';
    focus.innerHTML = `<div class="panel-head"><h2>Your weekly MindMelt update</h2><p class="muted">Generated for your selected ${escapeHTML(store.settings.weeklyDay)} night check-in.</p></div><div class="result-card ${strong?'success':'review'}"><p class="result-title"><span>${strong?'🔥':'🌱'}</span><span>${strong?'Great work this week.':'Let’s reset gently.'}</span></p><p class="meta">${escapeHTML(message)}</p><div class="productivity-number">${completed.length}</div><p class="meta">completed item${completed.length===1?'':'s'} this week</p></div>
      <div class="grid two"><div class="route-card"><h3>Completed this week</h3>${completed.length ? `<ul>${completed.slice(0,12).map(c=>`<li>${escapeHTML(c.title)} <span class="meta">${escapeHTML(label(c.category))}</span></li>`).join('')}</ul>` : '<p class="meta">No completed items logged yet. Start with one tiny obligation and mark it done.</p>'}</div><div class="route-card"><h3>Still on deck</h3>${open.length ? `<ul>${open.slice(0,12).map(i=>`<li>${escapeHTML(i.title)} <span class="meta">${escapeHTML(label(i.category))}</span></li>`).join('')}</ul>` : '<p class="meta">No dated open items right now. That is allowed.</p>'}</div></div><div class="confirm-row"><button class="pill" id="backCalendar">Back to Calendar</button></div>`;
    $('#backCalendar')?.addEventListener('click',renderMonthCalendar);
  }
  function renderItemCard(item){
    const done = item.done ? ' style="opacity:.55;text-decoration:line-through"' : '';
    const hasDate = !!(item.date || item.dateKey || parseItemDateKey(item));
    const dateLine = [item.date || (item.dateKey ? dateKeyDisplay(item.dateKey) : ''), hasDate ? timeRangeDisplay(item) : ''].filter(Boolean).join(' • ');
    const completeText = item.done ? 'Undo complete' : 'Complete';
    const timeButton = itemNeedsTime(item) ? `<button class="tiny-btn" data-set-time="${item.id}">Set time</button>` : '';
    return `<article class="item-card"><div><h3${done}>${icon(item.category)} ${escapeHTML(item.title)}</h3><p class="meta">${escapeHTML(label(item.category))}${dateLine ? ' • '+escapeHTML(dateLine) : ''}${item.completedAt ? ' • completed' : ''}</p></div><div class="item-actions">${timeButton}<button class="tiny-btn" data-done="${item.id}">${completeText}</button><button class="tiny-btn danger" data-delete-cat="${item.category}" data-delete-id="${item.id}">Delete</button></div></article>`;
  }
  function renderView(category){
    if(category === 'calendar'){ renderMonthCalendar(); return; }
    currentDayKey = '';
    setActive(category);
    const items = store[category] || [];
    focus.innerHTML = `<div class="category-title"><div><h2>${icon(category)} ${label(category)}</h2><p class="muted">${items.length} saved ${items.length === 1 ? 'item' : 'items'}</p></div><button class="pill" id="backHome">Home</button></div>${items.length ? `<div class="grid two">${items.map(renderItemCard).join('')}</div>` : `<div class="empty-list"><h3>Nothing here yet.</h3><p>Use the entry bar to capture something and MindMelt will route it.</p></div>`}`;
    $('#backHome')?.addEventListener('click',()=>renderIdle());
    bindItemActions();
  }
  function bindItemActions(){
    $$('[data-delete-id]').forEach(b=>b.addEventListener('click',()=>deleteItem(b.dataset.deleteCat,b.dataset.deleteId)));
    $$('[data-done]').forEach(b=>b.addEventListener('click',()=>toggleDone(b.dataset.done)));
    $$('[data-set-time]').forEach(b=>b.addEventListener('click',()=>renderTimeSetter(b.dataset.setTime)));
  }
  function bindMoveButtons(){
    $$('[data-move-id]').forEach(b=>b.addEventListener('click',()=>moveItem(b.dataset.moveFrom,b.dataset.moveId,b.dataset.moveTo)));
  }
  function bindExamples(){
    $$('[data-example]').forEach(b=>b.addEventListener('click',()=>{ input.value = b.dataset.example; input.focus(); }));
  }
  function handleEntry(raw){
    const result = E.decideEntry(raw);
    if(result.type === 'empty'){ renderIdle('Nothing entered yet.'); return; }
    addInbox(result.inbox);
    if(result.actions?.length){ result.actions.forEach(saveItem); lastAction = { type:'add', inboxId:result.inbox.id, items:result.actions }; }
    else { lastAction = { type:'add', inboxId:result.inbox.id, items:[] }; }
    saveStore();
    if(result.type === 'melt') renderMelt(result);
    else if(result.type === 'ask') renderAsk(result);
    else if(result.type === 'assist-bored') renderBored();
    else if(result.type === 'assist-stuck') renderStuck(result);
    else renderCapture(result);
  }
  function exportJSON(){
    const blob = new Blob([JSON.stringify(store,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `mindmelt-export-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importJSON(file){
    const reader = new FileReader();
    reader.onload = () => { try { store = Object.assign(defaultStore(), JSON.parse(reader.result)); hydrateStoreDates(); saveStore(); renderIdle('Data imported.'); } catch { alert('That file did not look like a MindMelt JSON export.'); } };
    reader.readAsText(file);
  }


  function itemDueDate(item){
    const key = item.dateKey || parseItemDateKey(item);
    if(!key) return null;
    let minute = parseTimeMinutes(`${item.time || ''} ${item.raw || ''}`);
    if(minute == null) minute = 9 * 60;
    const d = new Date(key + 'T00:00:00');
    if(Number.isNaN(d.getTime())) return null;
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
  }
  function upcomingNotificationItems(){
    const now = new Date();
    const leadMs = Number(store.settings.notificationLeadMinutes || 60) * 60 * 1000;
    const windowEnd = new Date(now.getTime() + leadMs);
    return ['calendar','tasks'].flatMap(cat => (store[cat] || []).map(item => ({...item, category:cat})))
      .filter(item => !item.done)
      .map(item => ({ item, due:itemDueDate(item) }))
      .filter(x => x.due && x.due >= now && x.due <= windowEnd)
      .sort((a,b)=>a.due-b.due);
  }
  async function registerServiceWorker(){
    if(!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.register('./sw.js'); }
    catch { return null; }
  }
  function notificationPermissionLabel(){
    if(!('Notification' in window)) return 'Notifications are not supported in this browser.';
    if(Notification.permission === 'granted' && store.settings.notificationsEnabled) return `Reminders are on: ${store.settings.notificationLeadMinutes || 60} minutes before upcoming tasks.`;
    if(Notification.permission === 'denied') return 'Notifications are blocked in this browser. Enable them in browser/site settings.';
    return 'Notifications are off.';
  }
  function updateNotificationSettingsUI(){
    const lead = $('#notificationLeadSelect');
    if(lead) lead.value = String(store.settings.notificationLeadMinutes || 60);
    const status = $('#notificationStatus');
    if(status) status.textContent = notificationPermissionLabel();
  }
  async function requestNotifications(){
    if(!('Notification' in window)){ alert('This browser does not support notifications yet.'); return; }
    await registerServiceWorker();
    const permission = await Notification.requestPermission();
    if(permission === 'granted'){
      store.settings.notificationsEnabled = true;
      store.settings.notificationLeadMinutes = Number($('#notificationLeadSelect')?.value || 60);
      store.settings.notified = store.settings.notified || {};
      saveStore();
      showReminderNotification('MindMelt reminders enabled', 'I’ll remind you about upcoming tasks and calendar obligations while the app is active.');
      checkUpcomingNotifications();
    }
    updateNotificationSettingsUI();
  }
  function showReminderNotification(title, body){
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, icon:'./icon-192.png', badge:'./icon-192.png', tag:'mindmelt-reminder', renotify:true };
    if(navigator.serviceWorker?.ready){
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(()=>new Notification(title, options));
    } else {
      new Notification(title, options);
    }
  }
  function checkUpcomingNotifications(){
    if(!store.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    store.settings.notified = store.settings.notified || {};
    const upcoming = upcomingNotificationItems();
    let changed = false;
    upcoming.forEach(({item,due}) => {
      const key = `${item.id}|${due.toISOString()}`;
      if(store.settings.notified[key]) return;
      const time = due.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
      showReminderNotification(`Upcoming: ${item.title}`, `${label(item.category)} due ${time}. You’ve got this — one step at a time.`);
      store.settings.notified[key] = new Date().toISOString();
      changed = true;
    });
    if(changed) saveStore();
  }
  function testNotification(){
    if(!store.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted'){
      requestNotifications();
      return;
    }
    showReminderNotification('MindMelt test reminder', 'This is what an upcoming task reminder will look like.');
  }

  function weekStamp(){
    const d=startOfWeek(new Date());
    return dateKey(d);
  }
  function maybeShowWeeklyMessage(){
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    if(day === store.settings.weeklyDay && store.settings.lastWeeklyMessageWeek !== weekStamp()){
      store.settings.lastWeeklyMessageWeek = weekStamp();
      saveStore();
      setTimeout(renderWeeklyReport, 400);
    }
  }
  function init(){
    hydrateStoreDates(); updateCounts(); bindExamples(); maybeShowWeeklyMessage(); registerServiceWorker(); updateNotificationSettingsUI(); checkUpcomingNotifications();
    input.addEventListener('input', () => $('#entryForm').classList.toggle('is-typing', input.value.trim().length > 0));
    input.addEventListener('blur', () => { if (!input.value.trim()) $('#entryForm').classList.remove('is-typing'); });
    $('#entryForm').addEventListener('submit', e=>{ e.preventDefault(); const raw=input.value.trim(); input.value=''; $('#entryForm').classList.remove('is-typing'); $('#entryForm').classList.add('captured-pulse'); setTimeout(()=>$('#entryForm').classList.remove('captured-pulse'), 700); handleEntry(raw); });
    $$('.dock-item').forEach(b=>b.addEventListener('click',()=>renderView(b.dataset.view)));
    $('#settingsButton').addEventListener('click',()=>$('#settingsDialog').showModal());
    $('#menuButton').addEventListener('click',()=>renderIdle('Capture first. Sort second.'));
    $('#enableNotificationsButton')?.addEventListener('click',requestNotifications);
    $('#testNotificationButton')?.addEventListener('click',testNotification);
    $('#notificationLeadSelect')?.addEventListener('change',()=>{ store.settings.notificationLeadMinutes = Number($('#notificationLeadSelect').value || 60); saveStore(); updateNotificationSettingsUI(); checkUpcomingNotifications(); });
    $('#exportButton').addEventListener('click',exportJSON);
    $('#importButton').addEventListener('click',()=>$('#importFile').click());
    $('#importFile').addEventListener('change',e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); });
    $('#clearButton').addEventListener('click',()=>{ if(confirm('Clear all local MindMelt beta data?')){ store=defaultStore(); saveStore(); renderIdle('Local data cleared.'); }});
    $('#voiceButton').addEventListener('click',()=>{
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SpeechRecognition){ input.placeholder = 'Voice input is not supported in this browser yet...'; input.focus(); return; }
      const rec = new SpeechRecognition(); rec.lang = 'en-US'; rec.onresult = ev => { input.value = ev.results[0][0].transcript; input.focus(); }; rec.start();
    });
    setInterval(()=>{ tickerIndex = (tickerIndex+1)%tickerMessages.length; $('#tickerText').textContent = tickerMessages[tickerIndex]; }, 17500);
    setInterval(checkUpcomingNotifications, 60000);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
