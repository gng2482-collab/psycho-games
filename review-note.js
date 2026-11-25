/* iPad 版のゲーム・一覧・復習ノートが同じブラウザ内で共有する記録。 */
(function () {
  'use strict';

  const context = document.currentScript.dataset;
  const prefix = 'pg-note-v1:';
  const intervals = [1, 3, 7];
  const maxRecords = 2000;
  const perDay = 10;

  function player() {
    try {
      return window.__ipadPlayer || localStorage.getItem('ipad-player') || 'me';
    } catch (error) {
      return 'me';
    }
  }

  function day(offset = 0, from = new Date()) {
    const d = new Date(from.getTime());
    d.setDate(d.getDate() + offset);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      .map(part => String(part).padStart(2, '0')).join('-');
  }

  function nextDay(from, interval) {
    return day(interval, new Date(from + 'T12:00:00'));
  }

  function load(name) {
    try {
      const events = JSON.parse(localStorage.getItem(prefix + name) || '[]');
      return Array.isArray(events) ? events : [];
    } catch (error) {
      return null;
    }
  }

  function save(name, events) {
    try {
      if (events.length) localStorage.setItem(prefix + name, JSON.stringify(events.slice(-maxRecords)));
      else localStorage.removeItem(prefix + name);
      return true;
    } catch (error) {
      return false;
    }
  }

  function progress(events, today) {
    const questions = new Map();
    const misses = [];
    let reviewed = 0;
    for (const event of events) {
      let question = questions.get(event.id);
      if (!question) {
        question = { id: event.id, app: event.app, group: event.group, step: 0 };
        questions.set(event.id, question);
      }
      if (event.review && event.day === today) reviewed++;
      if (!event.correct) {
        question.lastMiss = event;
        question.resolved = false;
        question.step = 0;
        question.due = nextDay(event.day, intervals[0]);
        misses.push(event);
      } else if (question.lastMiss) {
        question.resolved = true;
        if (event.day > question.lastMiss.day) question.overcome = true;
        if (question.due && event.day >= question.due && event.review) {
          question.step++;
          question.due = question.step < intervals.length
            ? nextDay(event.day, intervals[question.step]) : null;
        }
      }
    }
    const due = Array.from(questions.values())
      .filter(question => question.due && question.due <= today)
      .sort((a, b) => a.due.localeCompare(b.due)
        || Number(b.lastMiss.sure) - Number(a.lastMiss.sure)
        || a.lastMiss.at - b.lastMiss.at);
    return { questions, misses, due: due.slice(0, Math.max(0, perDay - reviewed)) };
  }

  function snapshot(name = player()) {
    const events = load(name);
    const result = progress(events || [], day());
    result.available = events !== null;
    result.overcome = Array.from(result.questions.values()).filter(q => q.overcome).length;
    return result;
  }

  function record(data, correct) {
    const app = data.app || context.app;
    if (!app || !data.q) return false;
    const where = data.where || context.where || '';
    const name = player();
    const events = load(name);
    if (!events) return false;
    const now = new Date();
    const event = {
      id: JSON.stringify([context.where || where || app, data.id || data.q]),
      app, group: data.group || context.group || '',
      at: now.getTime(), day: day(0, now), correct, sure: data.sure === true
    };
    if (!correct) {
      Object.assign(event, {
        q: data.q, picked: data.picked || '', answer: data.answer || '', why: data.why || '',
        where, context: data.context || '', options: Array.isArray(data.options) ? data.options : []
      });
    }
    return save(name, events.concat(event));
  }

  function review(card, picked, sure, scheduled) {
    const name = player();
    const events = load(name);
    if (!events) return { saved: false };
    const now = new Date();
    const today = day(0, now);
    const state = progress(events, today);
    const question = state.questions.get(card.id);
    const miss = question && question.lastMiss;
    if (!miss || miss.at !== card.at || (scheduled && !state.due.includes(question))) return null;

    const correct = picked === miss.answer;
    const event = correct
      ? { id: miss.id, app: miss.app, group: miss.group }
      : { ...miss, picked };
    Object.assign(event, {
      at: now.getTime(), day: today, correct, sure: sure === true,
      review: state.due.includes(question)
    });
    return { correct, saved: save(name, events.concat(event)) };
  }

  function erase(date) {
    const name = player();
    if (!date) return save(name, []);
    const events = load(name);
    return events !== null && save(name, events.filter(event => event.day !== date));
  }

  window.PG_NOTE = {
    player, day, snapshot, erase, review,
    miss: data => record(data, false),
    hit: data => record(data, true)
  };
})();
