import { useState, useEffect, useMemo } from "react";
import { PlusCircle, Trash2, Columns, Tag, XCircle, Loader2 } from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";


const Card = ({ children, className = "", ...props }) => (
  <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-3 ${className}`}>{children}</div>
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
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("tasks");
    const parsed = saved ? JSON.parse(saved) : [];
    // Ensure legacy tasks always have a tags array
    return Array.isArray(parsed)
      ? parsed.map((t) => ({ ...t, tags: Array.isArray(t?.tags) ? t.tags : [] }))
      : [];
  });
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState("all");
  const [swimlaneMode, setSwimlaneMode] = useState(false);
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

  // Persist
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(availableTags));
  }, [availableTags]);

  // Derived
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "todo") return t.status === "todo";
      if (filter === "inprogress") return t.status === "inprogress";
      if (filter === "completed") return t.status === "done";
      return true; // 'all'
    });
  }, [tasks, filter]);

  const lanes = useMemo(
    () => [
      { key: "todo", label: "To Do" },
      { key: "inprogress", label: "In Progress" },
      { key: "done", label: "Done" },
    ],
    []
  );

  // Actions
  const addTask = async () => {
    if (!newTask.trim()) return;
    setIsLoading(true);
    const task = {
      id: Date.now(),
      text: newTask.trim(),
      detail: "",
      status: "todo",
      tags: [],
    };
    await new Promise((r) => setTimeout(r, 150));
    setTasks((prev) => [...prev, task]);
    setNewTask("");
    setIsLoading(false);
  };

  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const moveTask = (id, newStatus) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));

  const openTask = (task) => {
    setSelectedTask(task);
    setTaskDetail(task.detail || "");
  };

  const saveDetail = async () => {
    if (!selectedTask) return;
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 250));
    setTasks((prev) =>
      prev.map((t) => (t.id === selectedTask.id ? { ...t, detail: taskDetail } : t))
    );
    setIsLoading(false);
    setSelectedTask(null);
  };

  const startTagging = (task) => {
    setTaggingTask(task);
    setTagInput("");
  };

  const addTagToTask = (tag) => {
    const trimmed = (tag || "").trim();
    if (!taggingTask) return; // safety
    if (!trimmed) return; // ignore empty

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taggingTask.id) return t;
        const safeTags = Array.isArray(t.tags) ? t.tags : [];
        if (safeTags.includes(trimmed)) return t; // dedupe
        return { ...t, tags: [...safeTags, trimmed] };
      })
    );

    setAvailableTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTagInput("");
    setTaggingTask(null); // close modal
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-blue-400 text-white p-4 flex items-center justify-between shadow-md">
        <div className="text-xl font-bold">To Do List</div>
        <Button
          variant="secondary"
          onClick={() => setSwimlaneMode((v) => !v)}
          className="bg-white text-blue-500 hover:bg-blue-50 cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Columns className="mr-2 h-4 w-4" />
          )}
          {swimlaneMode ? "List Mode" : "Swimlane Mode"}
        </Button>
      </header>

      {/* Main */}
      <main className="flex-grow p-6 flex flex-col items-center">
        <div className="w-full max-w-5xl">

          {/* Add Row */}
          <div className="flex gap-2 mb-4 items-center">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a new task..."
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-xl h-[44px] px-3 cursor-text disabled:opacity-60"
            />
            <Button
              onClick={addTask}
              disabled={!newTask.trim() || isLoading}
              className={`h-[44px] cursor-pointer font-semibold rounded-lg px-4 transition-colors
                ${!newTask.trim() || isLoading
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 text-white"}`}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              <span className="ml-1">Add</span>
            </Button>
          </div>

          {/* List Mode */}
          {!swimlaneMode && (
            <>
              <div className="flex justify-center gap-4 mb-6">
                {["all", "todo", "inprogress", "completed"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    disabled={isLoading}
                    className={`px-3 py-1 rounded-full border cursor-pointer ${
                      filter === f
                        ? "bg-blue-500 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {f === "todo"
                      ? "To-Do"
                      : f === "inprogress"
                      ? "In-Progress"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {filteredTasks.length === 0 && (
                  <p className="text-center text-gray-400">No tasks to show.</p>
                )}

                {filteredTasks.map((task) => (
                  <Card
                    key={task.id}
                    onClick={() => !isLoading && openTask(task)}
                    className={`flex justify-between items-center p-3 rounded-xl shadow-sm ${
                      isLoading ? "opacity-70" : "cursor-pointer hover:bg-blue-50 transition"
                    } ${task.status === "done" ? "bg-blue-50 line-through text-gray-500" : ""}`}
                  >
                    <CardContent className="flex items-center gap-3 p-0">
                      <span className="font-medium">{task.text}</span>
                      <select
                        value={task.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          moveTask(task.id, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isLoading}
                        className="text-xs border border-blue-200 rounded-md px-2 py-1 cursor-pointer bg-white disabled:opacity-50"
                      >
                        <option value="todo">To-Do</option>
                        <option value="inprogress">In-Progress</option>
                        <option value="done">Completed</option>
                      </select>
                      {Array.isArray(task.tags) && task.tags.length > 0 && (
                        <div className="flex gap-1 ml-2 flex-wrap">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>

                    <div className="flex gap-2 items-center">
                      {/* Toggle complete / revert to To-Do */}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLoading}
                        className="cursor-pointer text-green-600 disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTask(task.id, task.status === "done" ? "todo" : "done");
                        }}
                      >
                        {task.status === "done" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-green-500" />
                        )}
                      </Button>

                      {/* Tag button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        className="cursor-pointer disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          startTagging(task);
                        }}
                      >
                        <Tag className="text-blue-500" />
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading}
                        className="cursor-pointer disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(task.id);
                        }}
                      >
                        <Trash2 className="text-red-500" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Swimlane Mode */}
          {swimlaneMode && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              {lanes.map((lane) => (
                <div key={lane.key} className="bg-gray-50 rounded-xl p-3 shadow-inner">
                  <h2 className="text-lg font-semibold text-blue-500 mb-2 text-center">
                    {lane.label}
                  </h2>
                  {tasks.filter((t) => t.status === lane.key).length === 0 && (
                    <p className="text-center text-gray-400 text-sm">No tasks</p>
                  )}
                  {tasks
                    .filter((t) => t.status === lane.key)
                    .map((task) => (
                      <Card
                        key={task.id}
                        onClick={() => !isLoading && openTask(task)}
                        className={`p-3 mb-2 shadow-sm rounded-lg ${
                          isLoading ? "opacity-70" : "cursor-pointer hover:bg-blue-50 transition"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{task.text}</span>
                          <div className="flex gap-1">
                            {lane.key !== "todo" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isLoading}
                                className="cursor-pointer disabled:opacity-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(
                                    task.id,
                                    lane.key === "inprogress" ? "todo" : "inprogress"
                                  );
                                }}
                              >
                                ←
                              </Button>
                            )}
                            {lane.key !== "done" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isLoading}
                                className="cursor-pointer disabled:opacity-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(
                                    task.id,
                                    lane.key === "todo" ? "inprogress" : "done"
                                  );
                                }}
                              >
                                →
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isLoading}
                              className="cursor-pointer disabled:opacity-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.id);
                              }}
                            >
                              <Trash2 className="text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-lg">
            <h2 className="text-xl font-semibold text-blue-500 mb-3">{selectedTask.text}</h2>
            <ReactQuill
              theme="snow"
              value={taskDetail}
              onChange={setTaskDetail}
              placeholder="Add formatted details or paste screenshots..."
              className="rounded-lg border border-gray-300"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                onClick={() => setSelectedTask(null)}
                disabled={isLoading}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                onClick={saveDetail}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {taggingTask && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-lg">
            <h2 className="text-lg font-semibold text-blue-500 mb-3">Add Tag</h2>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tagInput.trim() && addTagToTask(tagInput)}
              placeholder="Type or select a tag..."
              disabled={isLoading}
              className="border border-gray-300 rounded-lg w-full p-2 mb-3 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {availableTags
                .filter((tag) => tag.toLowerCase().includes(tagInput.toLowerCase()))
                .map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTagToTask(tag)}
                    disabled={isLoading}
                    className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded-full hover:bg-blue-200 cursor-pointer disabled:opacity-50"
                  >
                    {tag}
                  </button>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setTaggingTask(null)}
                disabled={isLoading}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => tagInput.trim() && addTagToTask(tagInput)}
                disabled={isLoading || !tagInput.trim()}
                className="bg-blue-500 hover:bg-blue-600 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Save Tag"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/*
Manual test cases (quick):
1) Add task via Enter and Add button; input disabled while saving.
2) Filters: All / To-Do / In-Progress / Completed strictly match status.
3) Change status via select; verify swimlane reflects change.
4) Click complete icon; toggles To-Do ⇄ Completed. Completed shows X; clicking X reverts to To-Do.
5) Open a task; edit rich text; Save and Cancel behave, with spinner while saving.
6) Add tag by typing + Enter and by clicking a suggested tag; modal closes on save; duplicate tags ignored.
7) Persistence: reload page; tasks and tags remain. Legacy tasks without `tags` field don't crash when tagging.
*/
