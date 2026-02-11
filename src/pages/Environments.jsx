import React, { useEffect, useState, useRef, useContext } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { PlusCircle, Trash2, Merge, ChevronDown, ChevronRight, Filter, Download } from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";

const ENV_ORDER = ["Dev1", "Dev2", "Dev3", "Test", "Staging", "Production"];

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function EnvironmentsPage() {
  const { darkMode } = useContext(DarkModeContext) || {};
  
  const [work, setWork] = useState(() => {
    const raw = localStorage.getItem("envWork");
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [newText, setNewText] = useState("");
  const [chooseEnvFor, setChooseEnvFor] = useState(null);
  const inputRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collapsedEnvs, setCollapsedEnvs] = useState(() =>
    ENV_ORDER.reduce((acc, env) => ({ ...acc, [env]: false }), {})
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterEnv, setFilterEnv] = useState("");

  useEffect(() => { localStorage.setItem("envWork", JSON.stringify(work)); }, [work]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addWorkPrompt = (text) => {
    setChooseEnvFor({ id: makeId(), text });
  };

  const confirmAdd = (env) => {
    const entry = { id: chooseEnvFor.id, name: chooseEnvFor.text, environment: env, details: "", history: [{ env, at: Date.now() }] };
    setWork((w) => [entry, ...w]);
    setChooseEnvFor(null);
    setNewText("");
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && newText.trim()) {
      addWorkPrompt(newText.trim());
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    // move between environments
    const item = work.find((w) => w.id === draggableId);
    if (!item) return;
    const destEnv = destination.droppableId;
    if (item.environment === destEnv) return;
    setWork((cur) => cur.map((w) => w.id === draggableId ? { ...w, environment: destEnv, history: [...(w.history||[]), { env: destEnv, at: Date.now() }] } : w));
  };

  const startMerge = () => {
    setShowMergeModal(true);
  };

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [selectedMergeIds, setSelectedMergeIds] = useState(new Set());

  const toggleSelectMerge = (id) => {
    setSelectedMergeIds((s) => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const mergeSelected = () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    if (selectedMergeIds.size === 0) return;
    const ids = Array.from(selectedMergeIds);
    setWork((cur) => cur.map((w) => ids.includes(w.id) ? { ...w, environment: mergeTo, history: [...(w.history||[]), { env: mergeTo, at: Date.now() }] } : w));
    // reset modal
    setShowMergeModal(false);
    setMergeFrom("");
    setMergeTo("");
    setSelectedMergeIds(new Set());
  };

  const pageClasses = darkMode ? "text-white" : "text-gray-900";
  const panelClasses = darkMode
    ? "rounded-xl p-3 shadow-inner transition bg-gray-800"
    : "rounded-xl p-3 shadow-inner transition bg-gray-50";
  const panelHeaderClasses = darkMode
    ? "text-lg font-semibold mb-2 text-gray-300"
    : "text-lg font-semibold mb-2 text-blue-500";
  const inputClasses = darkMode
    ? "bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500"
    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400";
  const itemClasses = darkMode
    ? "p-3 rounded-lg border transition cursor-pointer bg-gray-700 border-gray-600 hover:bg-gray-650 text-gray-200"
    : "p-3 rounded-lg border transition cursor-pointer bg-white border-gray-200 hover:bg-blue-50 text-gray-900";
  const modalClasses = darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900";
  const softPanelClasses = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";

  const toggleEnvCollapsed = (env) => {
    setCollapsedEnvs((cur) => ({ ...cur, [env]: !cur[env] }));
  };

  const allCollapsed = ENV_ORDER.every((env) => collapsedEnvs[env]);

  const filteredWork = work.filter((w) => {
    const matchesText = filterText ? w.name.toLowerCase().includes(filterText.toLowerCase()) : true;
    const matchesEnv = filterEnv ? w.environment === filterEnv : true;
    return matchesText && matchesEnv;
  });

  const exportCsv = () => {
    const sorted = [...work].sort((a, b) => a.environment.localeCompare(b.environment));
    const escapeCsv = (value) => `"${String(value).replace(/"/g, "\"\"")}"`;
    const rows = sorted.map((w) => [w.name, w.environment]);
    const csv = [
      ["Feature", "Environment"],
      ...rows,
    ].map((row) => row.map(escapeCsv).join(",")).join("\n");

    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = String(today.getFullYear());
    const filename = `Environments_${day}${month}${year}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFilter = () => {
    setFilterText("");
    setFilterEnv("");
  };

  const renderPanel = (env) => {
    const envItems = work.filter((w) => w.environment === env);
    const visibleItems = filteredWork.filter((w) => w.environment === env);
    const isCollapsed = Boolean(collapsedEnvs[env]);
    const countClasses = darkMode ? "text-sm text-gray-500" : "text-sm text-gray-400";
    const headerIconClasses = darkMode ? "text-gray-500" : "text-gray-400";
    const panelStateClasses = isCollapsed ? "min-h-0" : "min-h-[200px]";

    return (
      <Droppable droppableId={env} key={env} isDropDisabled={isCollapsed}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`${panelClasses} ${panelStateClasses}`}>
            <button
              type="button"
              onClick={() => toggleEnvCollapsed(env)}
              className={`w-full flex items-center justify-start gap-2 ${panelHeaderClasses}`}
              aria-expanded={!isCollapsed}
              aria-controls={`env-panel-${env}`}
            >
              {isCollapsed ? (
                <ChevronRight className={`h-5 w-5 ${headerIconClasses}`} />
              ) : (
                <ChevronDown className={`h-5 w-5 ${headerIconClasses}`} />
              )}
              <span>{env}</span>
              <span className={countClasses}>({envItems.length})</span>
            </button>
            {!isCollapsed && (
              <div id={`env-panel-${env}`} className="flex flex-col gap-2">
                {visibleItems.length === 0 && (
                  <p className={`text-center text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>No work</p>
                )}
                {visibleItems.map((w, idx) => (
                  <Draggable draggableId={w.id} index={idx} key={w.id}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className={`flex items-center justify-between ${itemClasses}`}
                        onClick={() => setSelectedItem(w)}
                      >
                        <span className="font-medium">{w.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteCandidate(w); setShowDeleteConfirm(true); }}
                          title="Delete"
                          className={`p-1 rounded ${darkMode ? "text-gray-400 hover:text-red-400 hover:bg-gray-600" : "text-red-500 hover:bg-red-50"}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className={`w-full ${pageClasses}`}>
      <div className="flex items-center gap-2 mb-5">
        <input
          ref={inputRef}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a new piece of work..."
          className={`flex-1 border rounded px-3 py-2 ${inputClasses}`}
        />
        <button
          onClick={() => newText.trim() && addWorkPrompt(newText.trim())}
          className="px-3 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          Add
        </button>
        <button
          onClick={startMerge}
          className="px-3 py-2 bg-emerald-500 text-white rounded flex items-center gap-2"
        >
          <Merge className="h-4 w-4" />
          Merge
        </button>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          className={`px-3 py-2 rounded flex items-center gap-2 ${darkMode ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-700"}`}
        >
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <button
          onClick={exportCsv}
          className={`px-3 py-2 rounded flex items-center gap-2 ${darkMode ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-700"}`}
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {(filterOpen || filterText || filterEnv) && (
        <div className={`p-4 border rounded mb-4 ${softPanelClasses}`}>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search features..."
              className={`flex-1 border rounded px-3 py-2 ${inputClasses}`}
            />
            <select
              value={filterEnv}
              onChange={(e) => setFilterEnv(e.target.value)}
              className={`border rounded px-3 py-2 ${inputClasses}`}
            >
              <option value="">All environments</option>
              {ENV_ORDER.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
            <button
              onClick={clearFilter}
              className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {chooseEnvFor && (
        <div className={`p-4 border rounded mb-4 ${softPanelClasses}`}>
          <div className="mb-2">Choose environment for <strong>{chooseEnvFor.text}</strong></div>
          <div className="flex gap-2 flex-wrap">
            {ENV_ORDER.map((e) => (
              <button key={e} onClick={() => confirmAdd(e)} className={`px-3 py-1 border rounded ${darkMode ? "border-slate-700 hover:border-slate-500" : "border-slate-300 hover:border-slate-400"}`}>{e}</button>
            ))}
            <button onClick={() => { setChooseEnvFor(null); inputRef.current?.focus(); }} className={`px-3 py-1 border rounded ${darkMode ? "border-slate-700 hover:border-slate-500" : "border-slate-300 hover:border-slate-400"}`}>Cancel</button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className={`flex flex-col ${allCollapsed ? "gap-3" : "gap-6"}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderPanel("Dev1")}
            {renderPanel("Dev2")}
            {renderPanel("Dev3")}
          </div>
          {!allCollapsed && (
            <div className="flex justify-center">
              <ChevronDown className={`h-6 w-6 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
            </div>
          )}
          <div className="flex justify-center">
            <div className="w-full md:w-[70%] lg:w-[60%]">
              {renderPanel("Test")}
            </div>
          </div>
          {!allCollapsed && (
            <div className="flex justify-center">
              <ChevronDown className={`h-6 w-6 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
            </div>
          )}
          <div className="flex justify-center">
            <div className="w-full md:w-[65%] lg:w-[55%]">
              {renderPanel("Staging")}
            </div>
          </div>
          {!allCollapsed && (
            <div className="flex justify-center">
              <ChevronDown className={`h-6 w-6 ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
            </div>
          )}
          <div className="flex justify-center">
            <div className="w-full md:w-[60%] lg:w-[50%]">
              {renderPanel("Production")}
            </div>
          </div>
        </div>
      </DragDropContext>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-2xl ${modalClasses}`}>
            <h3 className="text-lg font-semibold mb-2">Merge Work</h3>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-sm">From</label>
                <select value={mergeFrom} onChange={(e) => { setMergeFrom(e.target.value); setSelectedMergeIds(new Set()); }} className={`w-full border p-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300"}`}>
                  <option value="">Select environment</option>
                  {ENV_ORDER.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm">To</label>
                <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} className={`w-full border p-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300"}`}>
                  <option value="">Select environment</option>
                  {ENV_ORDER.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <h4 className="font-semibold">Items in {mergeFrom || '...'}</h4>
              <div className={`max-h-40 overflow-auto border rounded p-2 ${darkMode ? "border-slate-700" : "border-slate-300"}`}>
                {(!mergeFrom || work.filter(w=>w.environment===mergeFrom).length===0) ? (<div className="text-sm text-gray-500">No items</div>) : (
                  work.filter(w=>w.environment===mergeFrom).map((w) => (
                    <label key={w.id} className="flex items-center gap-2 py-1">
                      <input type="checkbox" checked={selectedMergeIds.has(w.id)} onChange={() => toggleSelectMerge(w.id)} />
                      <span>{w.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowMergeModal(false); setSelectedMergeIds(new Set()); }} className={`px-3 py-1 border rounded ${darkMode ? "border-slate-700" : "border-slate-300"}`}>Cancel</button>
              <button disabled={!mergeFrom || !mergeTo || mergeFrom===mergeTo || selectedMergeIds.size===0} onClick={mergeSelected} className={`px-3 py-1 rounded ${(!mergeFrom || !mergeTo || mergeFrom===mergeTo || selectedMergeIds.size===0) ? 'bg-gray-200 text-gray-500' : 'bg-blue-500 text-white'}`}>Merge</button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-2xl ${modalClasses}`}>
            <input value={selectedItem.name} onChange={(e) => setSelectedItem((s) => ({ ...s, name: e.target.value }))} className={`w-full border p-2 mb-2 ${darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300"}`} />
            <ReactQuill theme="snow" value={selectedItem.details} onChange={(v) => setSelectedItem((s) => ({ ...s, details: v }))} />
            <div className="mt-3">
              <h4 className="font-semibold">History</h4>
              <ol className="text-sm">
                {(selectedItem.history||[]).map((h, i) => (
                  <li key={i}>{new Date(h.at).toLocaleString()} — {h.env}</li>
                ))}
              </ol>
            </div>
            <div className="flex justify-between items-center gap-2 mt-3">
              <div>
                <button onClick={() => { setDeleteCandidate(selectedItem); setShowDeleteConfirm(true); }} className={`px-3 py-1 border rounded text-red-500 ${darkMode ? "border-slate-700" : "border-slate-300"}`}>Delete</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedItem(null)} className={`px-3 py-1 border rounded ${darkMode ? "border-slate-700" : "border-slate-300"}`}>Close</button>
                <button onClick={() => {
                  // save changes
                  setWork((cur) => cur.map((it) => it.id === selectedItem.id ? { ...selectedItem, history: it.history } : it));
                  setSelectedItem(null);
                }} className="px-3 py-1 bg-blue-500 text-white rounded">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteCandidate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md ${modalClasses}`}>
            <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
            <p className="mb-4">Are you sure you want to delete this work item?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteCandidate(null); }} className={`px-3 py-1 border rounded ${darkMode ? "border-slate-700" : "border-slate-300"}`}>Cancel</button>
              <button onClick={() => {
                // perform deletion (irreversible)
                setWork((cur) => cur.filter((w) => w.id !== deleteCandidate.id));
                setShowDeleteConfirm(false);
                setDeleteCandidate(null);
                // ensure selectedItem closed
                setSelectedItem(null);
              }} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
