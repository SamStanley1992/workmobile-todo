import { useState, useEffect, useMemo, useRef, useContext } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { DarkModeContext } from "./AppRoutes.jsx";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  PlusCircle,
  Trash2,
  Columns,
  Tag,
  XCircle,
  Loader2,
  ClipboardList,
  Copy,
  Check,
  Download,
  Search,
  FileDown,
  AlertTriangle,
  Merge,
} from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const Card = ({ children, className = "", ...props }) => (
  <div
    className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}
    {...props}
  >
    {children}
  </div>
);

const Button = ({ children, className = "", ...props }) => (
  <button
    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default function ToDoApp() {
  const { darkMode } = useContext(DarkModeContext) || {};
  
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("tasks");
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed)
      ? parsed.map((t) => ({ ...t, tags: Array.isArray(t?.tags) ? t.tags : [], completedAt: t.completedAt || null }))
      : [];
  });

  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState("all"); // status filter in List mode: all, todo, inprogress, completed
  const [swimlaneMode, setSwimlaneMode] = useState(false);
  const newTaskInputRef = useRef(null);
  const filterInputRef = useRef(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetail, setTaskDetail] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState(() => {
    const saved = localStorage.getItem("tags");
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  });
  const [taggingTask, setTaggingTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showStandup, setShowStandup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Header / UI state
  const [showTextFilter, setShowTextFilter] = useState(false);
  const [textFilter, setTextFilter] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [deletedTasks, setDeletedTasks] = useState(() => {
    const saved = localStorage.getItem("deletedTasks");
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  });
  const [showBin, setShowBin] = useState(false);
  const [selectedDeletedIds, setSelectedDeletedIds] = useState(new Set());
  const [showCleanSlateConfirm, setShowCleanSlateConfirm] = useState(false);
  const [taskHistory, setTaskHistory] = useState([]);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);

  // Add to history whenever tasks change
  const pushHistory = (newTasks) => {
    setTaskHistory((prev) => [...prev.slice(-19), newTasks]);
  };

  // Undo last action
  const undo = () => {
    if (taskHistory.length === 0) return;
    setTasks(taskHistory[taskHistory.length - 1]);
    setTaskHistory((prev) => prev.slice(0, -1));
  };

  // Keyboard shortcut Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [taskHistory]);

  // Auto-focus filter input when opened
  useEffect(() => {
    if (showTextFilter && filterInputRef.current) {
      filterInputRef.current.focus();
    }
  }, [showTextFilter]);

  // Check if today is Friday
  const isFriday = new Date().getDay() === 5;

  // Get completed tasks from this week (Monday-Friday)
  const getWeeklyCompletedTasks = () => {
    const today = new Date();
    const Friday = new Date(today);
    Friday.setDate(today.getDate() - today.getDay() + 5); // Set to Friday
    const Monday = new Date(Friday);
    const weekStart = new Date(Monday);
    weekStart.setDate(weekStart.getDate() - 4); // Go back 4 days to Monday
    weekStart.setHours(0, 0, 0, 0);
    Friday.setHours(23, 59, 59, 999);

    return tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekStart && new Date(t.completedAt) <= Friday);
  };

  const handleCopyWeeklySummary = () => {
    const completed = getWeeklyCompletedTasks();
    const count = completed.length;
    const taskLabel = count === 1 ? "task" : "tasks";
    const summaryText = `Weekly Summary:\n\nYou completed ${count} ${taskLabel} this week.\n\n📋 Tasks:\n${completed.map((t) => `- ${t.text}`).join("\n")}`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => localStorage.setItem("tasks", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("tags", JSON.stringify(availableTags)), [availableTags]);
  useEffect(() => localStorage.setItem("deletedTasks", JSON.stringify(deletedTasks)), [deletedTasks]);

  const lanes = useMemo(
    () => [
      { key: "todo", label: "To-Do" },
      { key: "inprogress", label: "In-Progress" },
      { key: "done", label: "Completed" },
    ],
    []
  );

  // Derived filtered list (status + header text search)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "todo" && t.status !== "todo") return false;
      if (filter === "inprogress" && t.status !== "inprogress") return false;
      if (filter === "completed" && t.status !== "done") return false;
      if (textFilter && !t.text.toLowerCase().includes(textFilter.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filter, textFilter]);

  // Actions
  const addTask = async () => {
    if (!newTask.trim()) return;
    setIsLoading(true);
    const task = { id: Date.now(), text: newTask.trim(), detail: "", status: "todo", tags: [], completedAt: null };
    await new Promise((r) => setTimeout(r, 150));
    setTasks((prev) => {
      const updated = [...prev, task];
      pushHistory(prev);
      return updated;
    });
    setNewTask("");
    setIsLoading(false);
    if (newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  };

  const moveTask = (id, newStatus) =>
    setTasks((prev) => {
      pushHistory(prev);
      return prev.map((t) => (t.id === id ? { ...t, status: newStatus, completedAt: newStatus === "done" ? new Date().toISOString() : t.completedAt } : t));
    });

  // Delete -> move to bin with deletedAt
  const deleteTask = (id) => {
    setTasks((prev) => {
      pushHistory(prev);
      const found = prev.find((t) => t.id === id);
      if (!found) return prev;
      setDeletedTasks((dprev) => [{ ...found, deletedAt: Date.now() }, ...dprev]);
      return prev.filter((t) => t.id !== id);
    });
  };

  const openTask = (task) => {
    setSelectedTask(task);
    setTaskDetail(task.detail || "");
  };

  // Save title + detail from modal
  const saveDetail = async () => {
    if (!selectedTask) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    setTasks((prev) => {
      pushHistory(prev);
      return prev.map((t) => (t.id === selectedTask.id ? { ...t, detail: taskDetail, text: selectedTask.text } : t));
    });
    setIsLoading(false);
    setSelectedTask(null);
  };

  const startTagging = (task) => {
    setTaggingTask(task);
    setTagInput("");
  };

  const addTagToTask = (tag) => {
    const trimmed = (tag || "").trim();
    if (!taggingTask || !trimmed) return;
    setTasks((prev) => {
      pushHistory(prev);
      return prev.map((t) => (t.id !== taggingTask.id ? t : { ...t, tags: Array.isArray(t.tags) ? (t.tags.includes(trimmed) ? t.tags : [...t.tags, trimmed]) : [trimmed] } ));
    });
    setAvailableTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTagInput("");
    setTaggingTask(null);
  };

  const removeTagFromTask = (taskId, tagToRemove) => {
    setTasks((prev) => {
      pushHistory(prev);
      return prev.map((t) => (t.id === taskId ? { ...t, tags: (t.tags || []).filter((tg) => tg !== tagToRemove) } : t));
    });
  };

  // Daily Update Summary copy handler
  const handleCopySummary = () => {
    const inProgress = tasks.filter((t) => t.status === "inprogress");
    const recentDone = tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000));
    const summaryText = `Daily Update:\n\n🟦 In Progress:\n${inProgress.length ? inProgress.map((t) => `- ${t.text}`).join("\n") : "- None"}\n\n✅ Completed (since yesterday):\n${recentDone.length ? recentDone.map((t) => `- ${t.text}`).join("\n") : "- None"}`;
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export CSV
  const statusLabel = (status) => (status === "todo" ? "To Do" : status === "inprogress" ? "In Progress" : "Done");
  const exportCSV = () => {
    const escape = (s) => `"${String(s).replaceAll('"', '""')}"`;
    const rows = tasks.map((t) => `${escape(t.text)},${escape(statusLabel(t.status))}`);
    const csv = ["Task,Status", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Restore deleted - prevent duplicates by checking if already exists
  const restoreDeleted = (ids) => {
    if (!ids || ids.length === 0) return;
    const idsToRestore = Array.isArray(ids) ? ids : [ids];
    
    // Find items to restore - must be done inside callback with current state
    setTasks((cur) => {
      pushHistory(cur);
      const toRestore = deletedTasks.filter((d) => idsToRestore.includes(d.id));
      const existingIds = new Set(cur.map((t) => t.id));
      const noDups = toRestore.filter((t) => !existingIds.has(t.id));
      const restored = noDups.map((t) => ({ ...t, status: "todo", deletedAt: undefined }));
      return [...restored, ...cur];
    });
    
    // Remove from deleted tasks
    setDeletedTasks((prev) => prev.filter((d) => !idsToRestore.includes(d.id)));
    setSelectedDeletedIds(new Set());
  };

  // Deduplicate deleted tasks by id (keep first occurrence)
  const uniqueDeletedTasks = useMemo(() => {
    const seen = new Set();
    return deletedTasks.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [deletedTasks]);

  // Drag & drop: reorder within same column or move between columns
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const srcId = source.droppableId;
    const dstId = destination.droppableId;
    const id = Number(draggableId);

    setTasks((prev) => {
      const listFor = (status) => prev.filter((t) => t.status === status);
      if (srcId === dstId) {
        const status = srcId;
        const list = listFor(status);
        const moving = list.find((t) => t.id === id);
        if (!moving) return prev;
        const without = list.filter((t) => t.id !== id);
        without.splice(destination.index, 0, moving);
        // rebuild by statuses in canonical order
        const statuses = ["todo", "inprogress", "done"];
        const rebuilt = [];
        statuses.forEach((s) => {
          if (s === status) rebuilt.push(...without);
          else rebuilt.push(...prev.filter((t) => t.status === s));
        });
        return rebuilt;
      }
      // move between columns
      const srcList = prev.filter((t) => t.status === srcId && t.id !== id);
      const moving = prev.find((t) => t.id === id);
      if (!moving) return prev;
      const dstList = prev.filter((t) => t.status === dstId);
      const newDst = [...dstList];
      newDst.splice(destination.index, 0, { ...moving, status: dstId });
      const statuses = ["todo", "inprogress", "done"];
      const rebuilt = [];
      statuses.forEach((s) => {
        if (s === srcId) rebuilt.push(...srcList);
        else if (s === dstId) rebuilt.push(...newDst);
        else rebuilt.push(...prev.filter((t) => t.status === s));
      });
      return rebuilt;
    });
  };

  // prune deletedTasks older than 24h on render
  useEffect(() => {
    setDeletedTasks((prev) => prev.filter((d) => !d.deletedAt || d.deletedAt > Date.now() - 24 * 60 * 60 * 1000));
  }, []);

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      {/* Task Page Header */}
      <header className={`p-4 flex items-center justify-center gap-4 flex-wrap shadow-md ${darkMode ? "bg-gray-800 border-b border-gray-700" : "bg-gray-50 border-b border-gray-200"}`}>
        <Button
          onClick={() => {
            setShowTextFilter((v) => !v);
            setShowMoreMenu(false);
          }}
          className={`cursor-pointer ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-white text-blue-600 hover:bg-blue-50"}`}
        >
          <Search className="h-4 w-4" /> Filter
        </Button>

        {showTextFilter && (
          <div className={`flex items-center rounded h-[40px] ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-300"}`}>
            <input
              ref={filterInputRef}
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Search tasks..."
              className={`px-3 py-2 w-64 text-sm outline-none flex-1 ${darkMode ? "bg-gray-800 text-gray-200 placeholder-gray-500" : "bg-white text-gray-900 placeholder-gray-400"}`}
            />
            <button
              onClick={() => {
                setTextFilter("");
                setShowTextFilter(false);
              }}
              className={`text-lg px-2 ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`}
              title="Clear"
            >
              ✕
            </button>
          </div>
        )}

        <Button
          variant="secondary"
          onClick={() => setSwimlaneMode((v) => !v)}
          className={`cursor-pointer ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-white text-blue-600 hover:bg-blue-50"}`}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Columns className="mr-2 h-4 w-4" />}
          {swimlaneMode ? "List Mode" : "Swimlane Mode"}
        </Button>

        <Button onClick={() => { exportCSV(); }} className={`cursor-pointer ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-white text-green-600 hover:bg-green-50"}`}>
          <FileDown className="h-4 w-4" /> Export
        </Button>

        <Button onClick={() => setShowStandup(true)} className="bg-blue-500 hover:bg-blue-600 text-white cursor-pointer">
          <ClipboardList className="h-4 w-4" /> Daily Update
        </Button>

        {isFriday && (
          <Button onClick={() => setShowWeeklySummary(true)} className="bg-purple-500 hover:bg-purple-600 text-white cursor-pointer">
            <ClipboardList className="h-4 w-4" /> Weekly Summary
          </Button>
        )}

        <div className="relative">
            <Button onClick={() => setShowMoreMenu((v) => !v)} className={`cursor-pointer px-3 py-2 ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-white text-blue-600 hover:bg-blue-50"}`}>
              More
            </Button>
            {showMoreMenu && (
              <div className={`absolute right-0 mt-2 w-48 border rounded shadow p-2 z-50 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}>
                <button onClick={() => { setShowBin(true); setShowMoreMenu(false); }} className={`w-full text-left px-2 py-2 rounded hover:opacity-80 flex items-center gap-2 ${darkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-900 hover:bg-gray-100"}`}><Trash2 className="h-4 w-4" /> Bin</button>
                <button onClick={() => { setShowMoreMenu(false); setShowCleanSlateConfirm(true); }} className={`w-full text-left px-2 py-2 rounded hover:opacity-80 flex items-center gap-2 ${darkMode ? "text-red-400 hover:bg-gray-700" : "text-red-600 hover:bg-gray-100"}`}><AlertTriangle className="h-4 w-4" /> Clean Slate</button>
              </div>
            )}
        </div>
      </header>


      {/* Main */}
      <main className="flex-grow p-6 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          {/* Add Row */}
          <div className="flex gap-2 mb-4 items-center">
            <input
              ref={newTaskInputRef}
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a new task..."
              disabled={isLoading}
              className={`flex-1 border border-gray-300 rounded-xl h-[44px] px-3 cursor-text disabled:opacity-60 ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`}
            />
            <Button onClick={addTask} disabled={!newTask.trim() || isLoading} className={`h-[44px] w-[44px] flex items-center justify-center rounded-lg transition-colors ${!newTask.trim() || isLoading ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-green-500 hover:bg-green-600 text-white"}`} title="Add Task">
              {isLoading ? <Loader2 height={28} width={28} className="animate-spin" /> : <PlusCircle height={28} width={28} />}
            </Button>
          </div>

          {/* Status filter badges for list mode */}
          {!swimlaneMode && (
            <div className="flex justify-center gap-4 mb-6">
              {["all", "todo", "inprogress", "completed"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} disabled={isLoading} className={`px-3 py-1 rounded-full border ${filter === f ? "bg-blue-500 text-white" : darkMode ? "border-gray-600 text-gray-400 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-100"} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {f === "todo" ? "To-Do" : f === "inprogress" ? "In-Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* DragDropContext wraps both modes */}
          <DragDropContext onDragEnd={handleDragEnd}>

            {/* List view: when filter === specific status, allow reordering within that list. If filter === 'all' show simple list without reordering. */}
            {!swimlaneMode && (
              <div className="flex flex-col gap-2">
                {filteredTasks.length === 0 && <p className={`text-center ${darkMode ? "text-gray-500" : "text-gray-400"}`}>No tasks to show.</p>}

                {filter !== "all" ? (
                  <Droppable droppableId={filter}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {filteredTasks.map((task, index) => (
                          <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                            {(prov) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} onClick={() => !isLoading && openTask(task)}>
                                <div className={`flex justify-between items-center p-3 rounded-xl shadow-sm border transition ${darkMode ? "bg-gray-800 border-gray-700 hover:bg-gray-750" : "bg-white border-gray-200 hover:bg-blue-50"} ${isLoading ? "opacity-70" : "cursor-pointer"} ${task.status === "done" ? darkMode ? "bg-gray-700 line-through text-gray-500" : "bg-blue-50 line-through text-gray-500" : ""}`}>
                                  <div className="p-3 flex items-center gap-3 p-0 flex-wrap">
                                    <div className="flex flex-col gap-1"><span className="font-medium">{task.text}</span></div>

                                    <select value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); moveTask(task.id, e.target.value); }} disabled={isLoading} className={`text-xs border rounded-md px-2 py-1 cursor-pointer disabled:opacity-50 ${darkMode ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-blue-200 text-gray-900"}`}>
                                      <option value="todo">To-Do</option>
                                      <option value="inprogress">In-Progress</option>
                                      <option value="done">Completed</option>
                                    </select>

                                    {Array.isArray(task.tags) && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">{task.tags.map((tag) => (<span key={tag} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{tag}<button onClick={(e) => { e.stopPropagation(); removeTagFromTask(task.id, tag); }} className="text-blue-500 hover:text-red-500 focus:outline-none" title="Remove tag">×</button></span>))}</div>
                                    )}
                                  </div>

                                  <div className="flex gap-2 items-center">
                                    <Button disabled={isLoading} className="text-green-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); moveTask(task.id, task.status === "done" ? "todo" : "done"); }}>
                                      {task.status === "done" ? <XCircle className="h-4 w-4 text-red-500" /> : <Loader2 className="h-4 w-4 text-green-500" />}
                                    </Button>

                                    <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); startTagging(task); }}><Tag className="text-blue-500" /></Button>

                                    <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}><Trash2 className="text-red-500" /></Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ) : (
                  filteredTasks.map((task) => (
                    <div key={task.id} onClick={() => !isLoading && openTask(task)} className={`flex justify-between items-center p-3 rounded-xl shadow-sm border transition ${darkMode ? "bg-gray-800 border-gray-700 hover:bg-gray-750" : "bg-white border-gray-200 hover:bg-blue-50"} ${isLoading ? "opacity-70" : "cursor-pointer"} ${task.status === "done" ? darkMode ? "bg-gray-700 line-through text-gray-500" : "bg-blue-50 line-through text-gray-500" : ""}`}>
                      <div className="p-3 flex items-center gap-3 p-0 flex-wrap">
                        <div className="flex flex-col gap-1"><span className="font-medium">{task.text}</span></div>

                        <select value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); moveTask(task.id, e.target.value); }} disabled={isLoading} className="text-xs border border-blue-200 rounded-md px-2 py-1 cursor-pointer bg-white disabled:opacity-50">
                          <option value="todo">To-Do</option>
                          <option value="inprogress">In-Progress</option>
                          <option value="done">Completed</option>
                        </select>

                        {Array.isArray(task.tags) && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">{task.tags.map((tag) => (<span key={tag} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{tag}<button onClick={(e) => { e.stopPropagation(); removeTagFromTask(task.id, tag); }} className="text-blue-500 hover:text-red-500 focus:outline-none" title="Remove tag">×</button></span>))}</div>
                        )}
                      </div>

                      <div className="flex gap-2 items-center">
                        <Button disabled={isLoading} className="text-green-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); moveTask(task.id, task.status === "done" ? "todo" : "done"); }}>{task.status === "done" ? <XCircle className="h-4 w-4 text-red-500" /> : <Loader2 className="h-4 w-4 text-green-500" />}</Button>
                        <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); startTagging(task); }}><Tag className="text-blue-500" /></Button>
                        <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}><Trash2 className="text-red-500" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Swimlane Mode */}
            {swimlaneMode && (
              <div className="grid grid-cols-3 gap-4 mt-6">
                {lanes.map((lane) => (
                  <Droppable key={lane.key} droppableId={lane.key}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`rounded-xl p-3 shadow-inner min-h-[200px] transition ${darkMode ? snapshot.isDraggingOver ? "bg-gray-700" : "bg-gray-800" : snapshot.isDraggingOver ? "bg-blue-50" : "bg-gray-50"}`}>
                        <h2 className={`text-lg font-semibold mb-2 text-center ${darkMode ? "text-gray-300" : "text-blue-500"}`}>{lane.label}</h2>

                        {tasks.filter((t) => t.status === lane.key).length === 0 && <p className={`text-center text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>No tasks</p>}

                        {tasks.filter((t) => t.status === lane.key).map((task, index) => (
                          <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} onClick={() => !isLoading && openTask(task)} className={`p-3 mb-2 rounded-lg border transition cursor-pointer ${darkMode ? "bg-gray-700 border-gray-600 hover:bg-gray-650" : "bg-white border-gray-200 hover:bg-blue-50"} ${snap.isDragging ? darkMode ? "shadow-lg bg-gray-600" : "shadow-lg bg-blue-100" : ""}`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex flex-col gap-1">
                                    <span className={`font-medium ${darkMode ? "text-gray-200" : "text-gray-900"}`}>{task.text}</span>

                                    {Array.isArray(task.tags) && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">{task.tags.map((tag) => (<span key={tag} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${darkMode ? "bg-gray-600 text-gray-300" : "bg-blue-100 text-blue-700"}`}>{tag}<button onClick={(e) => { e.stopPropagation(); removeTagFromTask(task.id, tag); }} className={`hover:text-red-500 focus:outline-none ${darkMode ? "text-gray-400" : "text-blue-500"}`} title="Remove tag">×</button></span>))}</div>
                                    )}
                                  </div>

                                  <div className="flex gap-0.5 items-center">
                                    {lane.key !== "todo" && <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); moveTask(task.id, lane.key === "inprogress" ? "todo" : "inprogress"); }} className={`cursor-pointer p-1 ${darkMode ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600" : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"}`} title="Move Left"><ArrowLeftCircle className="h-5 w-5" /></Button>}
                                    {lane.key !== "done" && <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); moveTask(task.id, lane.key === "todo" ? "inprogress" : "done"); }} className={`cursor-pointer p-1 ${darkMode ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600" : "text-green-500 hover:text-green-700 hover:bg-green-50"}`} title="Move Right"><ArrowRightCircle className="h-5 w-5" /></Button>}

                                    <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); startTagging(task); }} className={`cursor-pointer p-1 ${darkMode ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600" : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"}`} title="Add Tag"><Tag className="h-5 w-5" /></Button>

                                    <Button disabled={isLoading} onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className={`cursor-pointer p-1 ${darkMode ? "text-gray-400 hover:text-red-400 hover:bg-gray-600" : "text-red-500 hover:bg-red-50"}`} title="Delete Task"><Trash2 className="h-5 w-5" /></Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            )}

          </DragDropContext>
        </div>
      </main>

      {/* Daily Update Modal */}
      {showStandup && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-3xl shadow-lg border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${darkMode ? "text-gray-200" : "text-blue-500"}`}>Daily Update</h2>
              <button onClick={() => setShowStandup(false)}><XCircle className={`w-6 h-6 ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`} /></button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className={`text-lg font-medium mb-2 ${darkMode ? "text-gray-300" : "text-blue-600"}`}>In-Progress</h3>
                {tasks.filter((t) => t.status === "inprogress").length === 0 ? <p className={`italic ${darkMode ? "text-gray-500" : "text-gray-500"}`}>No tasks currently in progress.</p> : tasks.filter((t) => t.status === "inprogress").map((t) => (<div key={t.id} className={`border rounded-md p-2 mb-2 ${darkMode ? "border-gray-600 bg-gray-700 text-gray-200" : "border-blue-200 bg-blue-50 text-gray-900"}`}>{t.text}</div>))}
              </div>

              <div>
                <h3 className={`text-lg font-medium mb-2 ${darkMode ? "text-gray-300" : "text-green-600"}`}>Completed (since yesterday)</h3>
                {tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length === 0 ? <p className={`italic ${darkMode ? "text-gray-500" : "text-gray-500"}`}>No tasks completed since yesterday.</p> : tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).map((t) => (<div key={t.id} className={`border rounded-md p-2 mb-2 ${darkMode ? "border-gray-600 bg-gray-700 text-gray-200" : "border-green-200 bg-green-50 text-gray-900"}`}>{t.text}</div>))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button onClick={handleCopySummary} className={`${copied ? "bg-green-500 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}>
                {copied ? (<><Check className="h-4 w-4" /> Copied!</>) : (<><Copy className="h-4 w-4" /> Copy to Clipboard</>)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTask && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-lg shadow-lg ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white"}`}>
            <input value={selectedTask.text} onChange={(e) => setSelectedTask((s) => ({ ...s, text: e.target.value }))} className={`w-full border rounded px-3 py-2 mb-3 text-lg font-semibold ${darkMode ? "bg-gray-700 border-gray-600 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`} />
              <div className={darkMode ? "dark-mode" : ""}>
                <ReactQuill theme="snow" value={taskDetail} onChange={setTaskDetail} placeholder="Add formatted details or paste screenshots..." className={`rounded-lg border ${darkMode ? "border-gray-600" : "border-gray-300"}`} />
              </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setSelectedTask(null)} disabled={isLoading} className={`cursor-pointer disabled:opacity-50 ${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</Button>
              <Button onClick={saveDetail} disabled={isLoading} className="bg-blue-500 hover:bg-blue-600 cursor-pointer disabled:opacity-50">{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {taggingTask && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-sm shadow-lg ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white"}`}>
            <h2 className={`text-lg font-semibold mb-3 ${darkMode ? "text-gray-200" : "text-blue-500"}`}>Add Tag</h2>
            <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tagInput.trim() && addTagToTask(tagInput)} placeholder="Type or select a tag..." disabled={isLoading} className={`border rounded-lg w-full p-2 mb-3 disabled:opacity-50 ${darkMode ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400" : "border-gray-300 bg-white text-gray-900 placeholder-gray-500"}`} />
            <div className="flex flex-wrap gap-2 mb-3">{availableTags.filter((tag) => tag.toLowerCase().includes(tagInput.toLowerCase())).map((tag) => (<button key={tag} onClick={() => addTagToTask(tag)} disabled={isLoading} className={`text-sm px-2 py-1 rounded-full hover:opacity-80 cursor-pointer disabled:opacity-50 ${darkMode ? "bg-gray-700 text-gray-300 border border-gray-600" : "bg-blue-100 text-blue-600"}`}>{tag}</button>))}</div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTaggingTask(null)} disabled={isLoading} className={`cursor-pointer disabled:opacity-50 ${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</Button>
              <Button onClick={() => tagInput.trim() && addTagToTask(tagInput)} disabled={isLoading || !tagInput.trim()} className="bg-blue-500 hover:bg-blue-600 cursor-pointer disabled:opacity-50">{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Tag"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bin Modal */}
      {showBin && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-3xl shadow-lg border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${darkMode ? "text-gray-200" : "text-blue-500"}`}>Bin (deleted last 24h)</h2>
              <button onClick={() => setShowBin(false)}><XCircle className={`w-6 h-6 ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`} /></button>
            </div>

            <div>
              {uniqueDeletedTasks.length === 0 ? <p className={`italic ${darkMode ? "text-gray-500" : "text-gray-500"}`}>No recently deleted tasks.</p> : (
                <div className="space-y-2">
                  {uniqueDeletedTasks.map((d) => (
                    <label key={d.id} className={`flex items-center gap-2 border rounded p-2 ${darkMode ? "border-gray-700 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={selectedDeletedIds.has(d.id)} onChange={() => {
                        const s = new Set(selectedDeletedIds);
                        if (s.has(d.id)) s.delete(d.id); else s.add(d.id);
                        setSelectedDeletedIds(s);
                      }} />
                      <div className={`flex-1 ${darkMode ? "text-gray-200" : "text-gray-900"}`}>{d.text} <div className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"}`}>Deleted {new Date(d.deletedAt).toLocaleString()}</div></div>
                      <button onClick={() => restoreDeleted([d.id])} className={`px-2 py-1 ${darkMode ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}>Restore</button>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => { const ids = Array.from(selectedDeletedIds); restoreDeleted(ids); }}>Restore Selected</Button>
              <Button variant="secondary" onClick={() => setShowBin(false)} className={`${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Slate Confirmation Modal */}
      {showCleanSlateConfirm && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-sm shadow-lg border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <h2 className={`text-xl font-semibold mb-4 ${darkMode ? "text-gray-200" : "text-blue-500"}`}>Clear All Tasks?</h2>
            <p className={`mb-6 ${darkMode ? "text-gray-400" : "text-gray-700"}`}>This will permanently delete all tasks from your board. This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCleanSlateConfirm(false)} className={`${darkMode ? "bg-gray-700 hover:bg-gray-600 text-gray-200" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}>Cancel</Button>
              <Button onClick={() => { setTasks([]); setShowCleanSlateConfirm(false); }} className="bg-red-500 hover:bg-red-600 text-white">Clear All</Button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Summary Modal (Fridays only) */}
      {showWeeklySummary && isFriday && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 ${darkMode ? "bg-black/70" : "bg-white/70"}`}>
          <div className={`p-6 rounded-xl w-full max-w-3xl shadow-lg border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${darkMode ? "text-gray-200" : "text-purple-500"}`}>Weekly Summary</h2>
              <button onClick={() => setShowWeeklySummary(false)}><XCircle className={`w-6 h-6 ${darkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`} /></button>
            </div>

            <div className="mb-6">
              {(() => {
                const completed = getWeeklyCompletedTasks();
                const count = completed.length;
                return (
                  <div>
                    <p className={`text-lg font-medium mb-4 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>You completed {count} {count === 1 ? "task" : "tasks"} this week.</p>
                    {completed.length > 0 ? (
                      <div className="space-y-2">
                        {completed.map((t) => (
                          <div key={t.id} className={`border rounded-md p-2 ${darkMode ? "border-gray-600 bg-gray-700 text-gray-200" : "border-purple-200 bg-purple-50 text-gray-900"}`}>{t.text}</div>
                        ))}
                      </div>
                    ) : (
                      <p className={`italic ${darkMode ? "text-gray-500" : "text-gray-500"}`}>No tasks completed this week.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={handleCopyWeeklySummary} className={`${copied ? "bg-green-500 text-white" : "bg-purple-500 hover:bg-purple-600 text-white"}`}>
                {copied ? (<><Check className="h-4 w-4" /> Copied!</>) : (<><Copy className="h-4 w-4" /> Copy to Clipboard</>)}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
