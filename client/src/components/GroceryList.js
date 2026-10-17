import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { useUserData } from '../context/UserDataContext';
import { captureSession, isCurrentSession } from '../utils/session';
import { groceryCSV, groceryPDFTable, groceryText } from '../utils/groceryExport';

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

  return <div className="container mt-4">
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h2>Grocery List 🛒</h2>
      {savedList && <button className="btn btn-danger btn-sm" disabled={busy || view.conflict} onClick={deleteList}>Delete List</button>}
    </div>
    <label htmlFor="grocery-week">Week beginning Monday</label>
    <input id="grocery-week" type="date" className="form-control mb-2" value={weekStart} disabled={busy}
      onChange={event => { if (event.target.value) selectWeek(event.target.value); }} />
    {(view.error || planRecord.error) && <div role="alert" className="alert alert-danger">{view.error || planRecord.error}</div>}
    {busy && <p role="status">Loading or saving groceries...</p>}
    <button className="btn btn-secondary btn-sm mb-2" disabled={busy} onClick={reload}>Reload this week</button>
    {view.legacy.length > 0 && <div className="mb-2">
      <label htmlFor="legacy-grocery">Saved list</label>
      <select id="legacy-grocery" className="form-control" value={legacyId} disabled={busy}
        onChange={event => { request.current.version += 1; setLegacyId(event.target.value); setSearch(''); }}>
        <option value="">This week's list</option>
        {view.legacy.map(list => <option key={list._id} value={list._id}>Older undated list ({new Date(list.createdAt).toLocaleDateString()})</option>)}
      </select>
    </div>}
    <div className="card p-3 mb-4 bg-white shadow-sm">
      {savedList ? <div className="d-flex justify-content-between align-items-center">
        <span className="text-secondary">{legacyId ? 'Older undated list — not assigned to this week' : `Saved list for ${weekStart}`}</span>
        <button className="btn btn-warning btn-sm" disabled={!canGenerate} onClick={generateList}>🔄 Regenerate from Current Plan</button>
      </div> : <div className="text-center">
        <p className="mb-2">No saved list for this week.</p>
        <button className="btn btn-success" disabled={!canGenerate} onClick={generateList}>✨ Generate List from Weekly Plan</button>
        {planRecord.loaded && weeklyPlan.length === 0 && <p className="text-muted">Create a meal plan for this week first.</p>}
      </div>}
      {savedList?.weekStart === weekStart && savedList.sourcePlanRevision !== planRecord.revision && planRecord.loaded &&
        <p role="status" className="text-warning">The saved plan has changed. Regenerate this list to use it.</p>}
    </div>
    {savedList && <>
      <div className="card p-2 bg-light mb-3">
        <div className="d-flex gap-2 justify-content-center">
          <button className="btn btn-outline-primary btn-sm" disabled={!items.length || busy || view.conflict} onClick={exportCSV}>📄 CSV</button>
          <button className="btn btn-outline-danger btn-sm" disabled={!items.length || busy || view.conflict} onClick={exportPDF}>📕 PDF</button>
          <button className="btn btn-outline-success btn-sm" disabled={!items.length || busy || view.conflict} onClick={shareWhatsApp}>💬 WhatsApp</button>
        </div>
        <small>Exports include the complete saved list, including checked items.</small>
      </div>
      <input type="text" className="form-control mb-3" placeholder="Search ingredients..." value={search} onChange={event => setSearch(event.target.value)} />
      {filteredList.length === 0 ? <p>No ingredients found.</p> : <ul className="list-group">
        {filteredList.slice(0, showAll ? filteredList.length : 5).map(item => <li key={item._id}
          className={`list-group-item d-flex justify-content-between align-items-center ${item.checked ? 'bg-light text-decoration-line-through text-muted' : ''}`}
          style={{ cursor: 'pointer' }} onClick={() => toggleItem(item)}>
          <span>{item.name}{item.amount ? `: ${item.amount}` : ''}</span>
          <input type="checkbox" aria-label={`Bought ${item.name}${item.amount ? ` ${item.amount}` : ''}`} checked={item.checked}
            disabled={busy || view.conflict} onClick={event => event.stopPropagation()} onChange={() => toggleItem(item)} className="form-check-input" />
        </li>)}
      </ul>}
      {filteredList.length > 5 && <button className="btn btn-secondary mt-3" onClick={() => setShowAll(!showAll)}>{showAll ? '▲ Show Less' : '▼ Show More'}</button>}
    </>}
  </div>;
}

export default GroceryList;
