import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  PlusCircle,
  UserPlus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Tag,
  X,
  Calendar,
} from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";

const STORAGE_KEYS = {
  tasks: "teamTasks",
  assignments: "teamAssignments",
  subordinates: "teamSubordinates",
};

const PENDING_TASK_KEY = "teamTasksPendingDraft";

const UNASSIGNED_ID = "unassigned";

const STATUSES = [
  { key: "todo", label: "To-Do" },
  { key: "inprogress", label: "In-Progress" },
  { key: "done", label: "Completed" },
];

const makeId = () => Math.random().toString(36).slice(2, 10);

const safeParse = (value, fallback) => {
  try {
    const parsed = value ? JSON.parse(value) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const toLocalDateKey = (date) => {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDueDateInput = (value) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
};

const parseDueDateInput = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return { value: "", error: "" };
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return { value: "", error: "Use DD/MM/YYYY" };
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const test = new Date(year, month - 1, day);
  if (
    test.getFullYear() !== year ||
    test.getMonth() !== month - 1 ||
    test.getDate() !== day
  ) {
    return { value: "", error: "Invalid date" };
  }
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { value: iso, error: "" };
};

const droppableIdFor = (personId, status) => `${personId}::${status}`;

const parseDroppableId = (droppableId) => {
  const [personId, status] = droppableId.split("::");
  return { personId, status };
};

const normalizeOrderIndexes = (assignments, personId, status) => {
  const updated = assignments.map((a) => ({ ...a }));
  const column = updated
    .filter((a) => a.personId === personId && a.status === status)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  column.forEach((a, index) => {
    a.orderIndex = index;
  });
  return updated;
};

const reorderColumn = (assignments, personId, status, movedId, destinationIndex) => {
  const updated = assignments.map((a) => ({ ...a }));
  const column = updated
    .filter((a) => a.personId === personId && a.status === status)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIndex = column.findIndex((a) => a.id === movedId);
  if (currentIndex === -1) return updated;
  const [moved] = column.splice(currentIndex, 1);
  column.splice(destinationIndex, 0, moved);
  column.forEach((a, index) => {
    a.orderIndex = index;
  });
  return updated;
};

const ensureUnassignedAssignment = (assignments, taskId) => {
  const hasAssignee = assignments.some(
    (a) => a.taskId === taskId && a.personId !== UNASSIGNED_ID
  );
  const existingUnassigned = assignments.find(
    (a) => a.taskId === taskId && a.personId === UNASSIGNED_ID
  );

  if (hasAssignee && existingUnassigned) {
    return assignments.filter((a) => a.id !== existingUnassigned.id);
  }

  if (!hasAssignee && !existingUnassigned) {
    const orderIndex = assignments.filter(
      (a) => a.personId === UNASSIGNED_ID && a.status === "todo"
    ).length;
    return [
      ...assignments,
      {
        id: makeId(),
        taskId,
        personId: UNASSIGNED_ID,
        status: "todo",
        orderIndex,
        completedDate: null,
      },
    ];
  }

  return assignments;
};

export default function TeamTasksPage() {
  const { darkMode } = useContext(DarkModeContext) || {};

  const [tasks, setTasks] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.tasks);
    const parsed = safeParse(raw, []);
    return parsed.map((t) => ({
      ...t,
      tags: Array.isArray(t?.tags) ? t.tags : [],
      detail: t.detail || "",
      dueDate: t.dueDate || "",
    }));
  });

  const [assignments, setAssignments] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.assignments);
    const parsed = safeParse(raw, []);
    return parsed.map((a, index) => ({
      ...a,
      status: a.status || "todo",
      orderIndex: Number.isFinite(a.orderIndex) ? a.orderIndex : index,
      completedDate: a.completedDate || null,
    }));
  });

  const [subordinates, setSubordinates] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.subordinates);
    const parsed = safeParse(raw, []);
    return parsed.map((s) => ({
      ...s,
      name: s.name || "",
    }));
  });

  const [availableTags, setAvailableTags] = useState(() => {
    const raw = localStorage.getItem("tags");
    const parsed = safeParse(raw, []);
    return parsed;
  });

  const [editingSubordinateId, setEditingSubordinateId] = useState(null);
  const [editingSubordinateName, setEditingSubordinateName] = useState("");
  const [collapsedBoards, setCollapsedBoards] = useState(() => ({}));
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [tagPopoverTaskId, setTagPopoverTaskId] = useState(null);
  const [tagPopoverInput, setTagPopoverInput] = useState("");
  const [showQuickDelete, setShowQuickDelete] = useState(false);
  const [quickDeleteTaskId, setQuickDeleteTaskId] = useState(null);
  const [dueDateInput, setDueDateInput] = useState("");
  const [dueDateError, setDueDateError] = useState("");

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    detail: "",
    dueDate: "",
    tags: [],
    assignees: [],
  });
  const [tagInput, setTagInput] = useState("");

  const [pendingComplete, setPendingComplete] = useState(null);

  const titleInputRef = useRef(null);
  const newMemberInputRef = useRef(null);
  const dueDatePickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.subordinates, JSON.stringify(subordinates));
  }, [subordinates]);

  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(availableTags));
  }, [availableTags]);

  useEffect(() => {
    if (taskModalOpen) {
      titleInputRef.current?.focus();
    }
  }, [taskModalOpen]);

  useEffect(() => {
    if (showAddMemberModal) {
      newMemberInputRef.current?.focus();
    }
  }, [showAddMemberModal]);

  const todayKey = toLocalDateKey();

  const boards = useMemo(() => {
    return [
      { id: UNASSIGNED_ID, name: "Unassigned", locked: true },
      ...subordinates.map((s) => ({ id: s.id, name: s.name, locked: false })),
    ];
  }, [subordinates]);

  const getTaskById = (taskId) => tasks.find((t) => t.id === taskId);

  const assignmentsFor = (personId, status) => {
    return assignments
      .filter((a) => a.personId === personId && a.status === status)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const taskAssignees = (taskId) =>
    assignments.filter((a) => a.taskId === taskId && a.personId !== UNASSIGNED_ID);

  const isOverdue = (task, assignment) => {
    if (!task?.dueDate) return false;
    if (assignment?.status === "done") return false;
    return task.dueDate < todayKey;
  };

  const addSubordinate = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    setSubordinates((cur) => [
      ...cur,
      { id: makeId(), name: trimmed, createdAt: Date.now() },
    ]);
    return true;
  };

  const openAddMemberModal = () => {
    setNewMemberName("");
    setShowAddMemberModal(true);
  };

  const confirmAddMember = () => {
    const added = addSubordinate(newMemberName);
    if (added) {
      setShowAddMemberModal(false);
      setNewMemberName("");
    }
  };

  const startEditSubordinate = (subordinate) => {
    setEditingSubordinateId(subordinate.id);
    setEditingSubordinateName(subordinate.name);
  };

  const saveSubordinateName = () => {
    const name = editingSubordinateName.trim();
    if (!editingSubordinateId || !name) return;
    setSubordinates((cur) =>
      cur.map((s) => (s.id === editingSubordinateId ? { ...s, name } : s))
    );
    setEditingSubordinateId(null);
    setEditingSubordinateName("");
  };

  const deleteSubordinate = (subordinateId) => {
    setSubordinates((cur) => cur.filter((s) => s.id !== subordinateId));
    setAssignments((cur) => {
      const remaining = cur.filter((a) => a.personId !== subordinateId);
      const taskIds = new Set(remaining.map((a) => a.taskId));
      const affectedTasks = cur
        .filter((a) => a.personId === subordinateId)
        .map((a) => a.taskId);
      let updated = remaining;
      affectedTasks.forEach((taskId) => {
        const hasAssignee = updated.some(
          (a) => a.taskId === taskId && a.personId !== UNASSIGNED_ID
        );
        if (!hasAssignee) {
          updated = ensureUnassignedAssignment(updated, taskId);
        }
        taskIds.add(taskId);
      });
      return updated;
    });
  };

  const toggleBoardCollapse = (boardId) => {
    setCollapsedBoards((cur) => ({
      ...cur,
      [boardId]: !cur[boardId],
    }));
  };

  const collapseAllBoards = (collapsed) => {
    setCollapsedBoards((cur) => {
      const next = { ...cur };
      subordinates.forEach((s) => {
        next[s.id] = collapsed;
      });
      return next;
    });
  };

  const getDefaultAssignees = (preferredId) => {
    if (preferredId) return [preferredId];
    if (subordinates.length === 1) return [subordinates[0].id];
    return [];
  };

  const openNewTaskModal = (preferredAssigneeId) => {
    setSelectedTaskId(null);
    setTaskDraft({
      title: "",
      detail: "",
      dueDate: "",
      tags: [],
      assignees: getDefaultAssignees(preferredAssigneeId),
    });
    setDueDateInput("");
    setDueDateError("");
    setTagInput("");
    setTagPopoverTaskId(null);
    setTaskModalOpen(true);
  };

  useEffect(() => {
    const raw = localStorage.getItem(PENDING_TASK_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      setSelectedTaskId(null);
      setTaskDraft({
        title: draft?.title || "",
        detail: draft?.detail || "",
        dueDate: "",
        tags: [],
        assignees: [],
      });
      setDueDateInput("");
      setDueDateError("");
      setTagInput("");
      setTagPopoverTaskId(null);
      setTaskModalOpen(true);
      localStorage.removeItem(PENDING_TASK_KEY);
    } catch {
      localStorage.removeItem(PENDING_TASK_KEY);
    }
  }, []);

  useEffect(() => {
    const unassignedCount = assignments.filter((a) => a.personId === UNASSIGNED_ID).length;
    setCollapsedBoards((cur) => ({
      ...cur,
      [UNASSIGNED_ID]: unassignedCount === 0,
    }));
  }, [assignments]);

  useEffect(() => {
    const needsFix = assignments.some(
      (a) => a.personId === UNASSIGNED_ID && a.status !== "todo"
    );
    if (!needsFix) return;
    setAssignments((cur) => {
      let changed = false;
      const updated = cur.map((a) => {
        if (a.personId === UNASSIGNED_ID && a.status !== "todo") {
          changed = true;
          return { ...a, status: "todo", completedDate: null };
        }
        return a;
      });
      return changed ? normalizeOrderIndexes(updated, UNASSIGNED_ID, "todo") : cur;
    });
  }, [assignments]);

  const openEditTaskModal = (taskId) => {
    const task = getTaskById(taskId);
    if (!task) return;
    const assignees = taskAssignees(taskId).map((a) => a.personId);
    setSelectedTaskId(taskId);
    setTaskDraft({
      title: task.title,
      detail: task.detail,
      dueDate: task.dueDate || "",
      tags: task.tags || [],
      assignees,
    });
    setDueDateInput(formatDueDateInput(task.dueDate || ""));
    setDueDateError("");
    setTagInput("");
    setTagPopoverTaskId(null);
    setTaskModalOpen(true);
  };

  const addTagToDraft = (tag) => {
    const trimmed = (tag || "").trim();
    if (!trimmed) return;
    setTaskDraft((cur) => {
      if (cur.tags.includes(trimmed)) return cur;
      return { ...cur, tags: [...cur.tags, trimmed] };
    });
    setAvailableTags((cur) => (cur.includes(trimmed) ? cur : [...cur, trimmed]));
    setTagInput("");
  };

  const removeTagFromDraft = (tag) => {
    setTaskDraft((cur) => ({
      ...cur,
      tags: cur.tags.filter((t) => t !== tag),
    }));
  };

  const handleDueDateTextChange = (value) => {
    setDueDateInput(value);
    if (!value.trim()) {
      setTaskDraft((cur) => ({ ...cur, dueDate: "" }));
      setDueDateError("");
      return;
    }
    const parsed = parseDueDateInput(value);
    setDueDateError(parsed.error);
    if (parsed.value) {
      setTaskDraft((cur) => ({ ...cur, dueDate: parsed.value }));
    }
  };

  const openDatePicker = () => {
    if (dueDatePickerRef.current?.showPicker) {
      dueDatePickerRef.current.showPicker();
      return;
    }
    dueDatePickerRef.current?.focus();
    dueDatePickerRef.current?.click();
  };

  const addTagToTask = (taskId, tag) => {
    const trimmed = (tag || "").trim();
    if (!trimmed) return;
    setTasks((cur) =>
      cur.map((t) =>
        t.id === taskId
          ? { ...t, tags: t.tags.includes(trimmed) ? t.tags : [...t.tags, trimmed] }
          : t
      )
    );
    setAvailableTags((cur) => (cur.includes(trimmed) ? cur : [...cur, trimmed]));
  };

  const removeTagFromTask = (taskId, tag) => {
    setTasks((cur) =>
      cur.map((t) =>
        t.id === taskId ? { ...t, tags: t.tags.filter((tgt) => tgt !== tag) } : t
      )
    );
  };

  const openTagPopover = (taskId) => {
    setTagPopoverTaskId((cur) => (cur === taskId ? null : taskId));
    setTagPopoverInput("");
  };

  const requestQuickDelete = (taskId) => {
    setQuickDeleteTaskId(taskId);
    setShowQuickDelete(true);
  };

  const confirmQuickDelete = () => {
    if (!quickDeleteTaskId) return;
    setTasks((cur) => cur.filter((t) => t.id !== quickDeleteTaskId));
    setAssignments((cur) => cur.filter((a) => a.taskId !== quickDeleteTaskId));
    setShowQuickDelete(false);
    setQuickDeleteTaskId(null);
    setTagPopoverTaskId(null);
  };

  const saveTask = () => {
    const title = taskDraft.title.trim();
    if (!title || dueDateError) return;

    const nextOrderIndex = (list, personId, status) =>
      list.filter((a) => a.personId === personId && a.status === status).length;

    if (selectedTaskId) {
      setTasks((cur) =>
        cur.map((t) =>
          t.id === selectedTaskId
            ? { ...t, title, detail: taskDraft.detail, dueDate: taskDraft.dueDate, tags: taskDraft.tags }
            : t
        )
      );
      setAssignments((cur) => {
        let updated = cur.map((a) => ({ ...a }));
        const currentAssignees = new Set(
          updated
            .filter((a) => a.taskId === selectedTaskId && a.personId !== UNASSIGNED_ID)
            .map((a) => a.personId)
        );
        const nextAssignees = new Set(taskDraft.assignees);

        // remove assignments no longer selected
        updated = updated.filter(
          (a) => !(a.taskId === selectedTaskId && currentAssignees.has(a.personId) && !nextAssignees.has(a.personId))
        );

        // add new assignments
        taskDraft.assignees.forEach((personId) => {
          const exists = updated.some(
            (a) => a.taskId === selectedTaskId && a.personId === personId
          );
          if (!exists) {
            const orderIndex = nextOrderIndex(updated, personId, "todo");
            updated.push({
              id: makeId(),
              taskId: selectedTaskId,
              personId,
              status: "todo",
              orderIndex,
              completedDate: null,
            });
          }
        });

        updated = ensureUnassignedAssignment(updated, selectedTaskId);

        return updated;
      });
    } else {
      const newTask = {
        id: makeId(),
        title,
        detail: taskDraft.detail,
        dueDate: taskDraft.dueDate,
        tags: taskDraft.tags,
        createdAt: Date.now(),
      };
      setTasks((cur) => [newTask, ...cur]);
      setAssignments((cur) => {
        let updated = [...cur];
        if (taskDraft.assignees.length === 0) {
          updated.push({
            id: makeId(),
            taskId: newTask.id,
            personId: UNASSIGNED_ID,
            status: "todo",
            orderIndex: nextOrderIndex(updated, UNASSIGNED_ID, "todo"),
            completedDate: null,
          });
        } else {
          taskDraft.assignees.forEach((personId) => {
            updated.push({
              id: makeId(),
              taskId: newTask.id,
              personId,
              status: "todo",
              orderIndex: nextOrderIndex(updated, personId, "todo"),
              completedDate: null,
            });
          });
        }
        return updated;
      });
    }

    setTaskModalOpen(false);
    setSelectedTaskId(null);
  };

  const deleteTask = () => {
    if (!selectedTaskId) return;
    setTasks((cur) => cur.filter((t) => t.id !== selectedTaskId));
    setAssignments((cur) => cur.filter((a) => a.taskId !== selectedTaskId));
    setTaskModalOpen(false);
    setSelectedTaskId(null);
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const sourceInfo = parseDroppableId(source.droppableId);
    const destInfo = parseDroppableId(destination.droppableId);

    if (
      sourceInfo.personId === destInfo.personId &&
      sourceInfo.status === destInfo.status &&
      source.index === destination.index
    ) {
      return;
    }

    const moving = assignments.find((a) => a.id === draggableId);
    if (!moving) return;

    if (
      sourceInfo.personId === destInfo.personId &&
      sourceInfo.status === destInfo.status
    ) {
      setAssignments((cur) =>
        reorderColumn(cur, sourceInfo.personId, sourceInfo.status, moving.id, destination.index)
      );
      return;
    }

    const assigneeCount = taskAssignees(moving.taskId).length;
    if (destInfo.status === "done" && assigneeCount > 1) {
      setPendingComplete({
        assignmentId: moving.id,
        destInfo,
        destinationIndex: destination.index,
      });
      return;
    }

    applyAssignmentMove(moving.id, destInfo, destination.index, sourceInfo);
  };

  const applyAssignmentMove = (assignmentId, destInfo, destinationIndex, sourceInfo) => {
    setAssignments((cur) => {
      let updated = cur.map((a) => ({ ...a }));
      const moving = updated.find((a) => a.id === assignmentId);
      if (!moving) return cur;

      const taskId = moving.taskId;
      const existingDest = updated.find(
        (a) => a.taskId === taskId && a.personId === destInfo.personId && a.id !== assignmentId
      );

      updated = updated.filter((a) => a.id !== assignmentId);

      let movedId = assignmentId;
      if (existingDest) {
        existingDest.status = destInfo.status;
        existingDest.completedDate = destInfo.status === "done" ? new Date().toISOString() : null;
        movedId = existingDest.id;
      } else {
        updated.push({
          ...moving,
          personId: destInfo.personId,
          status: destInfo.status,
          completedDate: destInfo.status === "done" ? new Date().toISOString() : null,
          orderIndex: destinationIndex,
        });
      }

      updated = ensureUnassignedAssignment(updated, taskId);

      const sourcePersonId = sourceInfo?.personId || moving.personId;
      const sourceStatus = sourceInfo?.status || moving.status;
      updated = normalizeOrderIndexes(updated, sourcePersonId, sourceStatus);
      updated = reorderColumn(updated, destInfo.personId, destInfo.status, movedId, destinationIndex);

      return updated;
    });
  };

  const completeForOne = () => {
    if (!pendingComplete) return;
    applyAssignmentMove(
      pendingComplete.assignmentId,
      pendingComplete.destInfo,
      pendingComplete.destinationIndex
    );
    setPendingComplete(null);
  };

  const completeForAll = () => {
    if (!pendingComplete) return;
    const moving = assignments.find((a) => a.id === pendingComplete.assignmentId);
    if (!moving) {
      setPendingComplete(null);
      return;
    }
    setAssignments((cur) =>
      cur.map((a) =>
        a.taskId === moving.taskId
          ? { ...a, status: "done", completedDate: new Date().toISOString() }
          : a
      )
    );
    setPendingComplete(null);
  };

  const metricsFor = (personId) => {
    const assigned = assignments.filter((a) => a.personId === personId);
    const total = assigned.length;
    const inProgress = assigned.filter((a) => a.status === "inprogress").length;
    const completedToday = assigned.filter(
      (a) => a.status === "done" && a.completedDate && toLocalDateKey(new Date(a.completedDate)) === todayKey
    ).length;
    const overdue = assigned.filter((a) => {
      const task = getTaskById(a.taskId);
      return isOverdue(task, a);
    }).length;

    return { total, inProgress, completedToday, overdue };
  };

  const globalMetrics = useMemo(() => {
    const activeSubs = subordinates.map((s) => metricsFor(s.id));
    return activeSubs.reduce(
      (acc, cur) => ({
        total: acc.total + cur.total,
        inProgress: acc.inProgress + cur.inProgress,
        completedToday: acc.completedToday + cur.completedToday,
        overdue: acc.overdue + cur.overdue,
      }),
      { total: 0, inProgress: 0, completedToday: 0, overdue: 0 }
    );
  }, [assignments, tasks, subordinates]);

  const pageClasses = darkMode ? "text-white" : "text-gray-900";
  const panelClasses = darkMode
    ? "rounded-xl p-4 shadow-inner transition bg-gray-800"
    : "rounded-xl p-4 shadow-inner transition bg-gray-50";
  const softPanelClasses = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const modalClasses = darkMode ? "bg-gray-800 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const headerClasses = darkMode
    ? "text-lg font-semibold text-gray-200"
    : "text-lg font-semibold text-blue-600";
  const columnClasses = darkMode
    ? "bg-gray-900/40 border-gray-700"
    : "bg-white border-gray-200";
  const cardClasses = darkMode
    ? "bg-gray-700 border-gray-600 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-500";
  const canSaveTask = Boolean(taskDraft.title.trim()) && !dueDateError;

  return (
    <div className={`w-full ${pageClasses}`}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openNewTaskModal()}
              className="px-3 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              New Task
            </button>
            <button
              onClick={openAddMemberModal}
              className="px-3 py-2 bg-emerald-500 text-white rounded flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
            {subordinates.length > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => collapseAllBoards(true)}
                  className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                >
                  Collapse All
                </button>
                <button
                  onClick={() => collapseAllBoards(false)}
                  className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                >
                  Expand All
                </button>
              </div>
            )}
          </div>
        </div>

        {subordinates.length > 1 && (
          <div className={`p-3 border rounded ${softPanelClasses} flex flex-wrap gap-4 text-sm`}
          >
            <span>Total Tasks: {globalMetrics.total}</span>
            <span>In-Progress: {globalMetrics.inProgress}</span>
            <span>Completed Today: {globalMetrics.completedToday}</span>
            {globalMetrics.overdue > 0 && (
              <span className="text-red-500">Overdue: {globalMetrics.overdue}</span>
            )}
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-6">
          {boards.map((board) => {
            const metrics = metricsFor(board.id);
            const isCollapsed = Boolean(collapsedBoards[board.id]);
            const isUnassigned = board.id === UNASSIGNED_ID;
            const boardStatuses = isUnassigned ? [STATUSES[0]] : STATUSES;

            return (
              <div key={board.id} className={panelClasses}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleBoardCollapse(board.id)}
                      className={`p-1 rounded ${darkMode ? "text-gray-300" : "text-gray-500"}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                    {editingSubordinateId === board.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editingSubordinateName}
                          onChange={(e) => setEditingSubordinateName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveSubordinateName();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingSubordinateId(null);
                              setEditingSubordinateName("");
                            }
                          }}
                          className={`border rounded px-2 py-1 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                        />
                        <button
                          onClick={saveSubordinateName}
                          className="px-2 py-1 bg-blue-500 text-white rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingSubordinateId(null); setEditingSubordinateName(""); }}
                          className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {!board.locked && (
                          <button
                            onClick={() => openNewTaskModal(board.id)}
                            className={`p-1 rounded ${darkMode ? "text-gray-300" : "text-gray-500"}`}
                            title="New Task"
                          >
                            <PlusCircle className="h-4 w-4" />
                          </button>
                        )}
                        <h2 className={headerClasses}>{board.name}</h2>
                        {!board.locked && (
                          <button
                            onClick={() => startEditSubordinate(board)}
                            className={`p-1 rounded ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                            title="Rename team member"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>Total: {metrics.total}</span>
                    {!isUnassigned && <span>In-Progress: {metrics.inProgress}</span>}
                    {!isUnassigned && <span>Completed Today: {metrics.completedToday}</span>}
                    {metrics.overdue > 0 && (
                      <span className="text-red-500">Overdue: {metrics.overdue}</span>
                    )}
                    {!board.locked && (
                      <button
                        onClick={() => deleteSubordinate(board.id)}
                        className="p-1 rounded text-red-500"
                        title="Delete team member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className={`grid grid-cols-1 ${isUnassigned ? "" : "md:grid-cols-3"} gap-3`}>
                    {boardStatuses.map((status) => (
                      <Droppable
                        key={status.key}
                        droppableId={droppableIdFor(board.id, status.key)}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`rounded-lg border p-3 min-h-[150px] ${columnClasses}`}
                          >
                            <h3 className={`text-sm font-semibold mb-2 ${mutedText}`}>
                              {status.label}
                            </h3>
                            <div className="flex flex-col gap-2">
                              {assignmentsFor(board.id, status.key).map((assignment, index) => {
                                const task = getTaskById(assignment.taskId);
                                if (!task) return null;
                                const overdue = isOverdue(task, assignment);

                                return (
                                  <Draggable
                                    key={assignment.id}
                                    draggableId={assignment.id}
                                    index={index}
                                  >
                                    {(draggableProvided) => (
                                      <div
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        {...draggableProvided.dragHandleProps}
                                        className={`border rounded-lg p-3 cursor-pointer transition relative ${cardClasses} ${overdue ? (darkMode ? "border-red-500 bg-red-900/40 text-red-100" : "border-red-500 bg-red-100 text-red-900") : ""}`}
                                        onClick={() => openEditTaskModal(task.id)}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-medium break-words flex-1 min-w-0">{task.title}</span>
                                          <div className="task-actions flex items-center justify-end gap-0.5 flex-nowrap min-w-[60px] shrink-0">
                                            {overdue && <Clock className="h-4 w-4 text-red-600" />}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openTagPopover(task.id);
                                              }}
                                              title="Tags"
                                              className={`p-1 rounded ${darkMode ? "text-gray-300 hover:bg-gray-600" : "text-gray-500 hover:bg-gray-100"}`}
                                            >
                                              <Tag className="h-4 w-4" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                requestQuickDelete(task.id);
                                              }}
                                              title="Delete"
                                              className={`p-1 rounded ${darkMode ? "text-gray-300 hover:text-red-300 hover:bg-gray-600" : "text-gray-500 hover:text-red-500 hover:bg-red-50"}`}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </div>
                                        {task.tags?.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {task.tags.map((tag) => (
                                              <span
                                                key={tag}
                                                className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {tagPopoverTaskId === task.id && (
                                          <div
                                            className={`absolute right-2 top-10 z-10 w-56 border rounded-lg p-2 shadow-md ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`text-xs font-semibold ${mutedText}`}>Tags</span>
                                              <button
                                                onClick={() => setTagPopoverTaskId(null)}
                                                className={`p-1 rounded ${darkMode ? "text-gray-400" : "text-gray-500"}`}
                                              >
                                                <X className="h-3 w-3" />
                                              </button>
                                            </div>
                                            <div className="flex items-center gap-1 mb-2">
                                              <input
                                                value={tagPopoverInput}
                                                onChange={(e) => setTagPopoverInput(e.target.value)}
                                                placeholder="Add tag"
                                                className={`flex-1 border rounded px-2 py-1 text-xs ${darkMode ? "bg-gray-800 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900"}`}
                                              />
                                              <button
                                                onClick={() => {
                                                  addTagToTask(task.id, tagPopoverInput);
                                                  setTagPopoverInput("");
                                                }}
                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                                              >
                                                Add
                                              </button>
                                            </div>
                                            {task.tags?.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mb-2">
                                                {task.tags.map((tag) => (
                                                  <button
                                                    key={tag}
                                                    onClick={() => removeTagFromTask(task.id, tag)}
                                                    className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${darkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"}`}
                                                    title="Remove tag"
                                                  >
                                                    {tag}
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                            {availableTags.length > 0 && (
                                              <div className="flex flex-wrap gap-1">
                                                {availableTags.map((tag) => (
                                                  <button
                                                    key={tag}
                                                    onClick={() => addTagToTask(task.id, tag)}
                                                    className={`text-xs px-2 py-0.5 rounded-full border ${darkMode ? "border-gray-700 text-gray-300" : "border-gray-300 text-gray-600"}`}
                                                  >
                                                    {tag}
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showAddMemberModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md border ${modalClasses}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Add Team Member</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                ref={newMemberInputRef}
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmAddMember();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setShowAddMemberModal(false);
                  }
                }}
                placeholder="Team member name"
                className={`w-full border p-2 rounded ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddMember}
                  className="px-3 py-2 bg-emerald-500 text-white rounded"
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuickDelete && quickDeleteTaskId && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md border ${modalClasses}`}>
            <h3 className="text-lg font-semibold mb-2">Delete Task</h3>
            <p className="text-sm mb-4">
              Are you sure you want to delete
              <span className="font-semibold"> {getTaskById(quickDeleteTaskId)?.title || "this task"}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowQuickDelete(false); setQuickDeleteTaskId(null); }}
                className={`px-3 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                Cancel
              </button>
              <button
                onClick={confirmQuickDelete}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {taskModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-3xl border ${modalClasses}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{selectedTaskId ? "Edit Task" : "New Task"}</h3>
              <button
                onClick={() => setTaskModalOpen(false)}
                className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                ref={titleInputRef}
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((cur) => ({ ...cur, title: e.target.value }))}
                placeholder="Task title"
                className={`w-full border p-2 rounded ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />

              <ReactQuill
                theme="snow"
                value={taskDraft.detail}
                onChange={(value) => setTaskDraft((cur) => ({ ...cur, detail: value }))}
              />

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium">Due Date</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={dueDateInput}
                    onChange={(e) => handleDueDateTextChange(e.target.value)}
                    onFocus={openDatePicker}
                    placeholder="DD/MM/YYYY"
                    className={`border rounded px-2 py-1 w-36 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                  />
                  <button
                    type="button"
                    onClick={openDatePicker}
                    className={`p-2 rounded border ${darkMode ? "border-gray-700 text-gray-200" : "border-gray-300 text-gray-600"}`}
                    title="Open calendar"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
                <input
                  ref={dueDatePickerRef}
                  type="date"
                  value={taskDraft.dueDate}
                  onChange={(e) => {
                    setTaskDraft((cur) => ({ ...cur, dueDate: e.target.value }));
                    setDueDateInput(formatDueDateInput(e.target.value));
                    setDueDateError("");
                  }}
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                {taskDraft.dueDate && (
                  <button
                    onClick={() => {
                      setTaskDraft((cur) => ({ ...cur, dueDate: "" }));
                      setDueDateInput("");
                      setDueDateError("");
                    }}
                    className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                  >
                    Clear
                  </button>
                )}
                {dueDateError && (
                  <span className="text-xs text-red-500">{dueDateError}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Add tag"
                    className={`flex-1 border rounded px-2 py-1 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                  />
                  <button
                    onClick={() => addTagToDraft(tagInput)}
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                  >
                    Add Tag
                  </button>
                </div>
                {availableTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTagToDraft(tag)}
                        className={`px-2 py-1 rounded-full border ${darkMode ? "border-gray-700 text-gray-300" : "border-gray-300 text-gray-600"}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                {taskDraft.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {taskDraft.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${darkMode ? "bg-gray-700 text-gray-100" : "bg-gray-200 text-gray-700"}`}
                      >
                        {tag}
                        <button onClick={() => removeTagFromDraft(tag)}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold">Team Members</h4>
                {subordinates.length === 0 && (
                  <p className={`text-sm ${mutedText}`}>No team members yet. Tasks will be unassigned.</p>
                )}
                <div className="flex flex-wrap gap-3">
                  {subordinates.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={taskDraft.assignees.includes(sub.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTaskDraft((cur) => {
                            const next = new Set(cur.assignees);
                            if (checked) next.add(sub.id);
                            else next.delete(sub.id);
                            return { ...cur, assignees: Array.from(next) };
                          });
                        }}
                      />
                      <span>{sub.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div>
                  {selectedTaskId && (
                    <button
                      onClick={deleteTask}
                      className="px-3 py-2 bg-red-600 text-white rounded"
                    >
                      Delete Task
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTaskModalOpen(false)}
                    className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTask}
                    disabled={!canSaveTask}
                    className={`px-3 py-2 rounded ${canSaveTask ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-500"}`}
                  >
                    Save Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingComplete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md border ${modalClasses}`}>
            <h3 className="text-lg font-semibold mb-2">Complete Task</h3>
            <p className="text-sm mb-4">
              This task has multiple assignees. Mark completed for this person only, or for everyone?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingComplete(null)}
                className={`px-3 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                Cancel
              </button>
              <button
                onClick={completeForOne}
                className="px-3 py-1 rounded bg-blue-500 text-white flex items-center gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                This Person
              </button>
              <button
                onClick={completeForAll}
                className="px-3 py-1 rounded bg-emerald-500 text-white flex items-center gap-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                Everyone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
