import React from "react";
import { HashRouter, Routes, Route, Link, Outlet, useLocation } from "react-router-dom";
import ToDoApp from "./App.jsx";
import EnvironmentsPage from "./pages/Environments.jsx";
import TeamTasksPage from "./pages/TeamTasks.jsx";
import ReleaseSchedulePage from "./pages/ReleaseSchedule.jsx";
import { Menu, ClipboardList, Layers, Moon, Sun, Users, CalendarDays } from "lucide-react";

export const DarkModeContext = React.createContext();

function Layout() {
  const [open, setOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    const saved = localStorage.getItem("zenTasksDarkMode");
    return saved ? JSON.parse(saved) : false;
  });
  
  const location = useLocation();

  const pageTitle = React.useMemo(() => {
    if (location.pathname === "/environments") return "Environments";
    if (location.pathname === "/team-tasks") return "Team Tasks";
    if (location.pathname === "/release-schedule") return "Release Schedule";
    return "Tasks";
  }, [location.pathname]);

  // Sync darkMode to localStorage and document class
  React.useEffect(() => {
    localStorage.setItem("zenTasksDarkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const isDark = darkMode;

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className="min-h-screen flex">
        {/* Overlay backdrop when open (clicking closes) */}
        {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/30 z-30" />}

        {/* Slide-out menu (overlays content) */}
        <div className={`fixed inset-y-0 left-0 w-64 transform ${open ? "translate-x-0" : "-translate-x-64"} transition-transform z-40 ${isDark ? 'bg-green-700 text-white' : 'bg-green-400 text-white'}`}>
          <div className="p-4 border-b">
            <h3 className="text-lg font-bold">Sam2.0</h3>
          </div>
          <nav className="p-4 flex flex-col gap-2">
            <Link to="/" onClick={() => setOpen(false)} className={`px-3 py-2 rounded flex items-center gap-3 ${location.pathname === '/' ? (isDark ? 'bg-green-800' : 'bg-green-500') : 'hover:bg-green-500/80'}`}>
              <ClipboardList className="h-4 w-4" />
              <span>Tasks</span>
            </Link>
            <Link to="/environments" onClick={() => setOpen(false)} className={`px-3 py-2 rounded flex items-center gap-3 ${location.pathname === '/environments' ? (isDark ? 'bg-green-800' : 'bg-green-500') : 'hover:bg-green-500/80'}`}>
              <Layers className="h-4 w-4" />
              <span>Environments</span>
            </Link>
            <Link to="/team-tasks" onClick={() => setOpen(false)} className={`px-3 py-2 rounded flex items-center gap-3 ${location.pathname === '/team-tasks' ? (isDark ? 'bg-green-800' : 'bg-green-500') : 'hover:bg-green-500/80'}`}>
              <Users className="h-4 w-4" />
              <span>Team Tasks</span>
            </Link>
            <Link to="/release-schedule" onClick={() => setOpen(false)} className={`px-3 py-2 rounded flex items-center gap-3 ${location.pathname === '/release-schedule' ? (isDark ? 'bg-green-800' : 'bg-green-500') : 'hover:bg-green-500/80'}`}>
              <CalendarDays className="h-4 w-4" />
              <span>Release Schedule</span>
            </Link>
          </nav>
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
        </Route>
      </Routes>
    </HashRouter>
  );
}
