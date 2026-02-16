import React from "react";
import { HashRouter, Routes, Route, Link, Outlet, useLocation } from "react-router-dom";
import ToDoApp from "./App.jsx";
import EnvironmentsPage from "./pages/Environments.jsx";
import TeamTasksPage from "./pages/TeamTasks.jsx";
import ReleaseSchedulePage from "./pages/ReleaseSchedule.jsx";
import BugBuilderPage from "./pages/BugBuilder.jsx";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Menu, ClipboardList, Layers, Moon, Sun, Users, CalendarDays, Bug, GripVertical, Settings } from "lucide-react";

export const DarkModeContext = React.createContext();

const MENU_STORAGE_KEY = "zenTasksMenuOrder";
const MENU_LABELS_KEY = "zenTasksMenuLabels";
const MENU_ITEMS = [
  { id: "tasks", to: "/", label: "Tasks", icon: ClipboardList },
  { id: "environments", to: "/environments", label: "Environments", icon: Layers },
  { id: "team-tasks", to: "/team-tasks", label: "Team Tasks", icon: Users },
  { id: "release-schedule", to: "/release-schedule", label: "Release Schedule", icon: CalendarDays },
  { id: "bug-builder", to: "/bug-builder", label: "Bug Builder", icon: Bug },
];

const getOrderedMenuItems = () => {
  const storedOrder = localStorage.getItem(MENU_STORAGE_KEY);
  const storedLabels = localStorage.getItem(MENU_LABELS_KEY);
  const labelOverrides = storedLabels ? JSON.parse(storedLabels) : {};
  const withLabels = MENU_ITEMS.map((item) => ({
    ...item,
    label: labelOverrides[item.id] || item.label,
  }));
  if (!storedOrder) return withLabels;
  try {
    const order = JSON.parse(storedOrder);
    if (!Array.isArray(order)) return withLabels;
    const itemsById = new Map(withLabels.map((item) => [item.id, item]));
    const ordered = order.map((id) => itemsById.get(id)).filter(Boolean);
    const missing = withLabels.filter((item) => !order.includes(item.id));
    return [...ordered, ...missing];
  } catch {
    return withLabels;
  }
};

function Layout() {
  const [open, setOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem("zenTasksDarkMode");
    return saved ? JSON.parse(saved) : false;
  });
  const [menuItems, setMenuItems] = React.useState(() => getOrderedMenuItems());
  const [reorderMode, setReorderMode] = React.useState(false);
  
  const location = useLocation();

  const pageTitle = React.useMemo(() => {
    const match = menuItems.find((item) => item.to === location.pathname);
    return match?.label || "Tasks";
  }, [location.pathname, menuItems]);

  // Sync darkMode to localStorage and document class
  React.useEffect(() => {
    localStorage.setItem("zenTasksDarkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  React.useEffect(() => {
    localStorage.setItem(
      MENU_STORAGE_KEY,
      JSON.stringify(menuItems.map((item) => item.id))
    );
    const labelMap = menuItems.reduce((acc, item) => {
      acc[item.id] = item.label;
      return acc;
    }, {});
    localStorage.setItem(MENU_LABELS_KEY, JSON.stringify(labelMap));
  }, [menuItems]);

  React.useEffect(() => {
    if (!open && reorderMode) {
      setReorderMode(false);
    }
  }, [open, reorderMode]);

  const handleMenuDragEnd = (result) => {
    if (!result.destination) return;
    setMenuItems((items) => {
      const updated = Array.from(items);
      const [moved] = updated.splice(result.source.index, 1);
      updated.splice(result.destination.index, 0, moved);
      return updated;
    });
  };

  const updateMenuLabel = (id, value) => {
    setMenuItems((items) =>
      items.map((item) => (item.id === id ? { ...item, label: value } : item))
    );
  };

  const isDark = darkMode;

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className="min-h-screen flex">
        {/* Overlay backdrop when open (clicking closes) */}
        {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/30 z-30" />}

        {/* Slide-out menu (overlays content) */}
        <div className={`fixed inset-y-0 left-0 w-64 transform ${open ? "translate-x-0" : "-translate-x-64"} transition-transform z-40 ${isDark ? 'bg-green-700 text-white' : 'bg-green-400 text-white'}`}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-bold">Sam2.0</h3>
            <button
              onClick={() => setReorderMode((value) => !value)}
              className={`p-2 rounded border ${reorderMode ? "bg-white/10" : "border-white/30"}`}
              title={reorderMode ? "Finish reordering" : "Reorder menu"}
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
          <DragDropContext onDragEnd={handleMenuDragEnd}>
            <Droppable droppableId="menu">
              {(provided) => (
                <nav
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="p-4 flex flex-col gap-2"
                >
                  {menuItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.to;
                    return (
                      <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!reorderMode}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`rounded ${isActive ? (isDark ? 'bg-green-800' : 'bg-green-500') : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              {reorderMode && (
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="px-2 py-2 cursor-grab text-white/70"
                                  title="Drag to reorder"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                              )}
                              {reorderMode ? (
                                <div className="flex-1 px-2 py-2 rounded flex items-center gap-3">
                                  <Icon className="h-4 w-4" />
                                  <input
                                    value={item.label}
                                    onChange={(event) => updateMenuLabel(item.id, event.target.value)}
                                    className="bg-transparent border-b border-white/60 focus:outline-none text-white w-full"
                                  />
                                </div>
                              ) : (
                                <Link
                                  to={item.to}
                                  onClick={() => setOpen(false)}
                                  className={`flex-1 px-2 py-2 rounded flex items-center gap-3 ${isActive ? '' : 'hover:bg-green-500/80'}`}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{item.label}</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </nav>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Content area (no reserved space) */}
        <div className="flex-1 flex flex-col min-h-screen">
          <header className={`${isDark ? 'bg-gray-900 text-white' : 'bg-green-400 text-white'} p-3 flex items-center justify-between shadow-md`}>
            <button onClick={() => setOpen((v) => !v)} className="p-2 rounded border border-white/20 text-white"><Menu /></button>
            <h2 className="text-xl font-semibold">Sam2.0 - {pageTitle}</h2>
            <button onClick={() => setDarkMode((v) => !v)} className="p-2 rounded border border-white/20 text-white" title="Toggle Dark Mode">
              {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
          </header>
          <main className={`flex-1 p-6 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </DarkModeContext.Provider>
  );
}

export default function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ToDoApp />} />
          <Route path="environments" element={<EnvironmentsPage />} />
          <Route path="team-tasks" element={<TeamTasksPage />} />
          <Route path="release-schedule" element={<ReleaseSchedulePage />} />
          <Route path="bug-builder" element={<BugBuilderPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
