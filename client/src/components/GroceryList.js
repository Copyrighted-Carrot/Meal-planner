import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useUserData } from '../context/UserDataContext';
import { captureSession, isCurrentSession } from '../utils/session';
import { groceryCSV, groceryPDFTable, groceryText } from '../utils/groceryExport';
import './PlanningPages.css';

const emptyList = weekStart => ({ weekStart, list: null, legacy: [], loaded: false, busy: false, error: '', conflict: false });

function GroceryList() {
  const { weekStart, selectWeek, weeklyPlan, planRecord, loadPlan } = useUserData();
  const [state, setState] = useState(() => emptyList(weekStart));
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [legacyId, setLegacyId] = useState('');
  const current = useRef(state);
  const request = useRef({ version: 0, mounted: false, busy: false });
  const session = useRef(captureSession());
  const update = useCallback(next => { current.current = next; setState(next); }, []);
  const active = useCallback(version => request.current.mounted && request.current.version === version && isCurrentSession(session.current), []);

  const fetchLists = useCallback(async () => {
    if (request.current.busy) return;
    const version = ++request.current.version;
    request.current.busy = true;
    update({ ...emptyList(weekStart), busy: true });
    try {
      const { data } = await api.get('/grocery', { params: { weekStart } });
      if (!active(version)) return;
      update({ ...emptyList(weekStart), loaded: true,
        list: data.find(list => list.weekStart === weekStart) || null,
        legacy: data.filter(list => !list.weekStart) });
    } catch (error) {
      if (active(version)) update({ ...emptyList(weekStart), error: error.message });
    } finally {
      if (active(version)) request.current.busy = false;
    }
  }, [active, update, weekStart]);

  useEffect(() => {
    const lifecycle = request.current;
    lifecycle.mounted = true;
    lifecycle.busy = false;
    setSearch(''); setShowAll(false); setLegacyId('');
    loadPlan();
    fetchLists();
    return () => { lifecycle.mounted = false; lifecycle.version += 1; };
  }, [weekStart, loadPlan, fetchLists]);

  // A newly selected week never renders the previous week's list, even for a frame.
  const view = state.weekStart === weekStart ? state : emptyList(weekStart);
  const savedList = legacyId ? view.legacy.find(list => list._id === legacyId) || null : view.list;
  const busy = view.busy || planRecord.loading || planRecord.saving;
  const waitingForList = !view.loaded && !view.error;
  const waitingForPlan = planRecord.loading || (!planRecord.loaded && !planRecord.error);
  const showEmptyList = view.loaded && planRecord.loaded && !busy && !view.error && !planRecord.error;
  const canGenerate = view.loaded && planRecord.loaded && !busy && !view.conflict && Boolean(planRecord._id) && weeklyPlan.length > 0;

  const mutate = async action => {
    if (request.current.busy || !view.loaded || view.conflict) return;
    request.current.busy = true;
    const version = ++request.current.version;
    update({ ...current.current, busy: true, error: '' });
    try {
      const result = await action();
      if (!active(version)) return;
      const previous = current.current;
      update({ ...previous, busy: false,
        list: result?.weekStart === weekStart ? result : result === null && !legacyId ? null : previous.list,
        legacy: legacyId && !result?.weekStart ? previous.legacy.flatMap(list => list._id === legacyId ? (result ? [result] : []) : [list]) : previous.legacy });
      if (result?.weekStart === weekStart || result === null) setLegacyId('');
    } catch (error) {
      if (active(version)) update({ ...current.current, busy: false, conflict: true,
        error: error.statusCode === 409 ? 'The plan or list changed. Reload before making more changes.' : `${error.message} Reload to confirm the saved list before retrying.` });
    } finally {
      if (active(version)) request.current.busy = false;
    }
  };

  const generateList = () => {
    if (!canGenerate) return;
    return mutate(async () => (await api.post('/grocery', {
      weekStart, sourcePlanId: planRecord._id, sourcePlanRevision: planRecord.revision,
      revision: view.list?.revision || 0,
    })).data);
  };

  const toggleItem = item => {
    if (!savedList || busy) return;
    return mutate(async () => (await api.put(`/grocery/${savedList._id}`, {
      itemId: item._id, checked: !item.checked, revision: savedList.revision || 0,
    })).data);
  };

  const deleteList = () => {
    if (!savedList || busy || !window.confirm('Are you sure you want to delete this list?')) return;
    return mutate(async () => {
      await api.delete(`/grocery/${savedList._id}`, { params: { revision: savedList.revision || 0 } });
      return null;
    });
  };

  const reload = () => { if (!busy) { loadPlan(true); fetchLists(); } };
  const items = savedList?.items || [];
  const filteredList = items.filter(item => `${item.name} ${item.amount || ''}`.toLowerCase().includes(search.toLowerCase()));

  const exportCSV = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF', groceryCSV(items)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'grocery_list.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const exportPDF = async () => {
    const version = request.current.version;
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      if (!active(version)) return;
      const doc = new jsPDF();
      doc.setFontSize(20); doc.text('My Grocery List', 14, 20);
      autoTable(doc, groceryPDFTable(items));
      doc.save('grocery_list.pdf');
    } catch (_) {
      if (active(version)) update({ ...current.current, error: 'PDF export failed. Please try again.' });
    }
  };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`*My Grocery List*\n\n${groceryText(items)}`)}`, '_blank', 'noopener,noreferrer');

  return <div className="page-surface grocery-page">
    <div className="page-heading mb-3">
      <h2>Grocery List 🛒</h2>
      {savedList && <button className="btn btn-danger btn-sm" disabled={busy || view.conflict} onClick={deleteList}>Delete List</button>}
    </div>
    <label htmlFor="grocery-week">Week beginning Monday</label>
    <input id="grocery-week" type="date" className="form-control mb-2" value={weekStart} disabled={busy}
      onChange={event => { if (event.target.value) selectWeek(event.target.value); }} />
    {(busy || waitingForList || waitingForPlan) && <div role="status" className="alert alert-info page-state">
      <p className="page-state-title">{waitingForList ? 'Loading your grocery list...' : waitingForPlan ? "Loading this week's plan..." : planRecord.saving ? "Saving this week's plan..." : 'Saving grocery changes...'}</p>
      <p>{waitingForList || waitingForPlan ? 'Checking the saved list and meal plan for the selected week.' : savedList ? 'Waiting for confirmation. Your saved items stay visible below.' : 'Please wait for this operation to finish.'}</p>
    </div>}
    <div role={view.error || planRecord.error ? 'alert' : undefined} className={view.error || planRecord.error ? 'alert alert-danger page-state' : undefined}>
      {(view.error || planRecord.error) && <>
        <p className="page-state-title">Grocery list needs attention.</p>
        <p className="page-state-detail">{view.error || planRecord.error}</p>
      </>}
      <button className="btn btn-secondary btn-sm mb-2" disabled={busy} onClick={reload}>Reload this week</button>
    </div>
    {view.legacy.length > 0 && <div className="mb-2">
      <label htmlFor="legacy-grocery">Saved list</label>
      <select id="legacy-grocery" className="form-control" value={legacyId} disabled={busy}
        onChange={event => { request.current.version += 1; setLegacyId(event.target.value); setSearch(''); }}>
        <option value="">This week's list</option>
        {view.legacy.map(list => <option key={list._id} value={list._id}>Older undated list ({new Date(list.createdAt).toLocaleDateString()})</option>)}
      </select>
    </div>}
    {(savedList || showEmptyList) && <div className={savedList ? 'card p-3 mb-4 bg-white shadow-sm' : 'alert page-state page-state-empty'}>
      {savedList ? <div className="page-actions grocery-summary-actions">
        <span className="text-secondary grocery-summary">{legacyId ? 'Older undated list — not assigned to this week' : `Saved list for ${weekStart}`}</span>
        <button className="btn btn-warning btn-sm" disabled={!canGenerate} onClick={generateList}>🔄 Regenerate from Current Plan</button>
      </div> : <>
        <p className="page-state-title">No saved list for this week.</p>
        <p>{weeklyPlan.length === 0 ? 'Create a meal plan for this week first.' : "Generate a grocery list from this week's saved meal plan."}</p>
        <div className="page-state-actions">
          <button className="btn btn-success" disabled={!canGenerate} onClick={generateList}>✨ Generate List from Weekly Plan</button>
          {weeklyPlan.length === 0 && <Link className="btn btn-secondary" to="/meal-planner">Open Meal Planner</Link>}
        </div>
      </>}
      {savedList?.weekStart === weekStart && savedList.sourcePlanRevision !== planRecord.revision && planRecord.loaded &&
        <p role="status" className="text-warning">The saved plan has changed. Regenerate this list to use it.</p>}
    </div>}
    {savedList && <>
      <div className="card p-2 bg-light mb-3">
        <div className="page-actions grocery-export-actions">
          <button className="btn btn-outline-primary btn-sm" disabled={!items.length || busy || view.conflict} onClick={exportCSV}>📄 CSV</button>
          <button className="btn btn-outline-danger btn-sm" disabled={!items.length || busy || view.conflict} onClick={exportPDF}>📕 PDF</button>
          <button className="btn btn-outline-success btn-sm" disabled={!items.length || busy || view.conflict} onClick={shareWhatsApp}>💬 WhatsApp</button>
        </div>
        <small>Exports include the complete saved list, including checked items.</small>
      </div>
      <input type="text" className="form-control mb-3" aria-label="Search ingredients" placeholder="Search ingredients..." value={search} onChange={event => setSearch(event.target.value)} />
      {filteredList.length === 0 ? <div className="alert page-state page-state-empty">
        <p className="page-state-title">{items.length ? 'No matching ingredients.' : 'No ingredients found.'}</p>
        <p>{items.length ? 'Try another search or clear the search field to see your saved items.' : 'This saved list has no ingredients.'}</p>
      </div> : <ul className="list-group">
        {filteredList.slice(0, showAll ? filteredList.length : 5).map(item => <li key={item._id}
          className={`list-group-item grocery-row ${item.checked ? 'bg-light text-decoration-line-through text-muted' : ''}`}
          onClick={() => toggleItem(item)}>
          <span className="grocery-item-text">{item.name}{item.amount ? `: ${item.amount}` : ''}</span>
          <input type="checkbox" aria-label={`Bought ${item.name}${item.amount ? ` ${item.amount}` : ''}`} checked={item.checked}
            disabled={busy || view.conflict} onClick={event => event.stopPropagation()} onChange={() => toggleItem(item)} className="form-check-input" />
        </li>)}
      </ul>}
      {filteredList.length > 5 && <button className="btn btn-secondary mt-3" onClick={() => setShowAll(!showAll)}>{showAll ? '▲ Show Less' : '▼ Show More'}</button>}
    </>}
  </div>;
}

export default GroceryList;
