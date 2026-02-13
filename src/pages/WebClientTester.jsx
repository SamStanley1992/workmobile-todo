import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  Trash2,
  GripVertical,
  Copy,
  Download,
  ExternalLink,
  Camera,
  CircleDot,
} from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";

const ENV_OPTIONS = ["Dev1", "Dev2", "Dev3", "Test", "Staging", "Production"];
const PLATFORM_OPTIONS = ["Web Client", "WM2 Portal"];
const SESSION_STORAGE_KEY = "webClientTesterSession";
const WS_PORT_KEY = "webClientTesterWsPort";
const DEFAULT_WS_PORT = 3001;
const DEBUG_WS = typeof window !== "undefined"
  && window.localStorage?.getItem("webClientTesterDebugWs") === "1";
const STORAGE_KEYS = {
  env: "webClientTesterEnv",
  stepType: "webClientTesterStepType",
};

const STEP_TEMPLATES = {
  Click: {
    template: 'Click "{element}"',
    fields: ["element"],
  },
  "Enter Text": {
    template: 'Enter "{value}" into "{field}"',
    fields: ["value", "field"],
  },
  Select: {
    template: 'Select "{option}" from "{dropdown}"',
    fields: ["option", "dropdown"],
  },
  Toggle: {
    template: 'Toggle "{element}"',
    fields: ["element"],
  },
  Navigate: {
    template: 'Navigate to "{destination}"',
    fields: ["destination"],
  },
  "See Error": {
    template: 'See error "{message}"',
    fields: ["message"],
  },
};

const REGRESSION_BLOCKS = {
  "Dirty State": [
    "Modify a field without saving",
    "Attempt to navigate away",
    "Confirm dirty state warning appears",
  ],
  "Permission Test": [
    "Attempt action with restricted role",
    "Confirm access denied behavior",
  ],
  "Session Behaviour": [
    "Leave tab idle for 10+ minutes",
    "Return and verify session handling",
  ],
  Persistence: [
    "Save changes",
    "Refresh the page",
    "Verify data persists",
  ],
};

const makeId = () => Math.random().toString(36).slice(2, 10);

const buildUrl = (env) => {
  const host = env === "Production" ? "www" : env.toLowerCase();
  return `https://${host}.esayworkmobile.co.uk/auth/sign-in`;
};

const formatElapsed = (seconds) => {
  if (!Number.isFinite(seconds)) return "";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
};

const dataUrlToBlob = (dataUrl) => {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const formatIncomingEvent = (payload) => {
  const label = payload?.label || payload?.text || payload?.name || "";
  const value = payload?.value || payload?.selected || payload?.input || "";
  const url = payload?.url || payload?.path || "";

  switch (payload?.type) {
    case "click":
      return label ? `Click "${label}"` : null;
    case "input":
      return label || value ? `Enter "${value || "[value]"}" into "${label || "[field]"}"` : null;
    case "select":
      return label || value ? `Select "${value || "[option]"}" from "${label || "[dropdown]"}"` : null;
    case "toggle":
      if (!label) return null;
      return payload?.checked ? `Enable "${label}"` : `Disable "${label}"`;
    case "navigation":
      return url ? `Navigate to "${url}"` : null;
    case "error":
      return payload?.message ? `See error "${payload.message}"` : null;
    default:
      return payload?.text ? payload.text : null;
  }
};

const buildExportText = ({
  title,
  account,
  steps,
  actual,
  expected,
  environment,
  platform,
  recordingStart,
  timestampsEnabled,
}) => {
  const lines = [];
  const pushSection = (sectionLines) => {
    if (!sectionLines.length) return;
    if (lines.length > 0) lines.push("");
    lines.push(...sectionLines);
  };

  if (title) pushSection([`Title: ${title}`]);
  if (environment) pushSection([`Environment: ${environment}`]);
  if (platform) pushSection([`Platform: ${platform}`]);
  if (account) pushSection([`Account: ${account}`]);
  if (steps.length > 0) {
    const stepLines = ["Steps:"];
    steps.forEach((step, index) => {
      const timestamp = timestampsEnabled && step.timestamp && recordingStart
        ? ` (${formatElapsed((step.timestamp - recordingStart) / 1000)})`
        : "";
      stepLines.push(`${index + 1}. ${step.text}${timestamp}`.trim());
      (step.screenshots || []).forEach((shot, shotIndex) => {
        stepLines.push(`   - Screenshot: step-${index + 1}-${shotIndex + 1}.png`);
      });
    });
    pushSection(stepLines);
  }
  if (actual) pushSection(["Actual Result:", actual]);
  if (expected) pushSection(["Expected Result:", expected]);

  return lines.join("\n");
};

export default function WebClientTesterPage() {
  const { darkMode } = useContext(DarkModeContext) || {};
  const [environment, setEnvironment] = useState("Test");
  const [platform, setPlatform] = useState("Web Client");
  const environmentUrl = useMemo(() => buildUrl(environment), [environment]);

  const [title, setTitle] = useState("");
  const [account, setAccount] = useState("");
  const [actual, setActual] = useState("");
  const [expected, setExpected] = useState("");
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingStart, setRecordingStart] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timestampsEnabled, setTimestampsEnabled] = useState(true);
  const [activeStepId, setActiveStepId] = useState(null);
  const [compactMode, setCompactMode] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [steps, setSteps] = useState([]);
  const [stepType, setStepType] = useState("Click");
  const [composerFields, setComposerFields] = useState({});
  const stepInputRefs = useRef({});
  const focusStepIdRef = useRef(null);
  const [wsPort, setWsPort] = useState(DEFAULT_WS_PORT);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [wsError, setWsError] = useState("");
  const wsRef = useRef(null);
  const wsReconnectRef = useRef(null);
  const wsCloseTimerRef = useRef(null);
  const recentEventRef = useRef(new Map());
  const timestampsRef = useRef(timestampsEnabled);
  const recordingStartRef = useRef(recordingStart);
  const recordingActiveRef = useRef(recordingActive);

  useEffect(() => {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    const storedStepType = localStorage.getItem(STORAGE_KEYS.stepType);
    const storedWsPort = localStorage.getItem(WS_PORT_KEY);
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        setEnvironment(session.environment || "Test");
        setPlatform(session.platform || "Web Client");
        setTitle(session.title || "");
        setAccount(session.account || "");
        setActual(session.actual || "");
        setExpected(session.expected || "");
        setSteps(
          Array.isArray(session.steps)
            ? session.steps.map((step) => ({
                id: step.id || makeId(),
                text: step.text || "",
                timestamp: step.timestamp || null,
                screenshots: step.screenshots || [],
              }))
            : []
        );
        setStepType(session.stepType || storedStepType || "Click");
        setComposerFields(session.composerFields || {});
        setTimestampsEnabled(session.timestampsEnabled ?? true);
        setRecordingStart(session.recordingStart || null);
        setElapsedSeconds(session.elapsedSeconds || 0);
        setCompactMode(session.compactMode || false);
        setWsPort(Number(session.wsPort || storedWsPort || DEFAULT_WS_PORT));
        return;
      } catch {
        // fall through to defaults
      }
    }

    const initialEnv = sessionStorage.getItem(STORAGE_KEYS.env) || "Test";
    setEnvironment(initialEnv);
    if (storedStepType && STEP_TEMPLATES[storedStepType]) {
      setStepType(storedStepType);
    }
    if (storedWsPort) {
      setWsPort(Number(storedWsPort));
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.env, environment);
  }, [environment]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.stepType, stepType);
  }, [stepType]);

  useEffect(() => {
    const payload = {
      environment,
      platform,
      title,
      account,
      actual,
      expected,
      steps,
      stepType,
      composerFields,
      timestampsEnabled,
      recordingStart,
      elapsedSeconds,
      compactMode,
      wsPort,
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [
    environment,
    platform,
    title,
    account,
    actual,
    expected,
    steps,
    stepType,
    composerFields,
    timestampsEnabled,
    recordingStart,
    elapsedSeconds,
    compactMode,
    wsPort,
  ]);

  useEffect(() => {
    localStorage.setItem(WS_PORT_KEY, String(wsPort));
  }, [wsPort]);

  useEffect(() => {
    if (!recordingActive) return undefined;
    const start = recordingStart || Date.now();
    if (!recordingStart) {
      setRecordingStart(start);
    }
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [recordingActive, recordingStart]);

  useEffect(() => {
    timestampsRef.current = timestampsEnabled;
  }, [timestampsEnabled]);

  useEffect(() => {
    recordingStartRef.current = recordingStart;
  }, [recordingStart]);

  useEffect(() => {
    recordingActiveRef.current = recordingActive;
  }, [recordingActive]);

  const appendStepFromEvent = (payload) => {
    const keyParts = [payload?.type, payload?.label, payload?.value, payload?.checked, payload?.timestamp];
    const key = keyParts.filter((part) => part !== undefined && part !== null).join("|");
    if (key) {
      const now = Date.now();
      const last = recentEventRef.current.get(key);
      if (last && now - last < 750) return;
      recentEventRef.current.set(key, now);
      if (recentEventRef.current.size > 50) {
        const entries = Array.from(recentEventRef.current.entries()).slice(-30);
        recentEventRef.current = new Map(entries);
      }
    }
    const text = formatIncomingEvent(payload);
    if (!text) return;
    const timestamp = timestampsRef.current
      ? payload?.timestamp || Date.now()
      : null;
    const newStep = {
      id: makeId(),
      text,
      timestamp,
      screenshots: [],
    };
    focusStepIdRef.current = newStep.id;
    setSteps((cur) => [...cur, newStep]);
    setActiveStepId(newStep.id);
  };

  const attachScreenshotToLatestStep = (dataUrl) => {
    setSteps((cur) => {
      if (cur.length === 0) return cur;
      const updated = [...cur];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = {
        ...last,
        screenshots: [...(last.screenshots || []), { id: makeId(), src: dataUrl }],
      };
      return updated;
    });
  };

  useEffect(() => {
    if (!wsPort) return undefined;
    const url = `ws://localhost:${wsPort}`;
    let active = true;

    if (wsCloseTimerRef.current) {
      clearTimeout(wsCloseTimerRef.current);
      wsCloseTimerRef.current = null;
    }

    const attachHandlers = (ws) => {
      ws.onopen = () => {
        setWsStatus("connected");
        setWsError("");
        if (DEBUG_WS) console.log("[WCT] WS open", url);
      };
      ws.onclose = () => {
        if (DEBUG_WS) console.log("[WCT] WS close", url);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!active) return;
        setWsStatus("disconnected");
        wsReconnectRef.current = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        setWsError("Recorder connection error");
        if (DEBUG_WS) console.warn("[WCT] WS error", url);
      };
      ws.onmessage = (event) => {
        if (DEBUG_WS) console.log("[WCT] WS message", event.data);
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "screenshot" && payload.dataUrl) {
            attachScreenshotToLatestStep(payload.dataUrl);
            return;
          }
          appendStepFromEvent(payload);
        } catch {
          // ignore malformed messages
        }
      };
    };

    const connect = () => {
      if (!active) return;
      setWsStatus("connecting");
      setWsError("");

      const existing = wsRef.current;
      if (existing && existing.url === url) {
        if (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) {
          attachHandlers(existing);
          return;
        }
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;
      attachHandlers(ws);
    };

    connect();

    return () => {
      active = false;
      if (wsReconnectRef.current) {
        clearTimeout(wsReconnectRef.current);
      }
      // Delay close so StrictMode double-mount doesn't tear down the socket.
      wsCloseTimerRef.current = setTimeout(() => {
        if (!wsRef.current) return;
        if (wsRef.current.url !== url) return;
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      }, 250);
    };
  }, [wsPort]);

  useEffect(() => {
    if (!focusStepIdRef.current) return;
    const targetId = focusStepIdRef.current;
    focusStepIdRef.current = null;
    requestAnimationFrame(() => {
      stepInputRefs.current[targetId]?.focus();
    });
  }, [steps]);

  const stepFields = STEP_TEMPLATES[stepType]?.fields || [];

  const handleEnvironmentChange = (value) => {
    setEnvironment(value);
  };

  const addStepText = (text, insertIndex = null) => {
    const newStep = {
      id: makeId(),
      text,
      timestamp: recordingActive && timestampsEnabled ? Date.now() : null,
      screenshots: [],
    };
    focusStepIdRef.current = newStep.id;
    setSteps((cur) => {
      if (insertIndex === null) return [...cur, newStep];
      const updated = [...cur];
      updated.splice(insertIndex + 1, 0, newStep);
      return updated;
    });
  };

  const handleAddStep = () => {
    const template = STEP_TEMPLATES[stepType];
    if (!template) return;
    let text = template.template;
    template.fields.forEach((field) => {
      const value = (composerFields[field] || "").trim();
      const replacement = value ? value : `[${field}]`;
      text = text.replace(`{${field}}`, replacement);
    });
    addStepText(text);
  };

  const addBlankStep = () => {
    addStepText("");
  };

  const updateStep = (id, value) => {
    setSteps((cur) => cur.map((step) => (step.id === id ? { ...step, text: value } : step)));
  };

  const removeStep = (id) => {
    setSteps((cur) => cur.filter((step) => step.id !== id));
  };

  const handleStepsDrag = (result) => {
    if (!result.destination) return;
    setSteps((cur) => {
      const updated = [...cur];
      const [moved] = updated.splice(result.source.index, 1);
      updated.splice(result.destination.index, 0, moved);
      return updated;
    });
  };

  const handleStepKey = (event, index) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addStepText("", index);
    }
  };

  const toggleRecording = () => {
    if (recordingActive) {
      setRecordingActive(false);
      return;
    }
    setRecordingStart(Date.now());
    setElapsedSeconds(0);
    setRecordingActive(true);
  };

  const addScreenshotToStep = (stepId, src) => {
    setSteps((cur) =>
      cur.map((step) =>
        step.id === stepId
          ? {
              ...step,
              screenshots: [...(step.screenshots || []), { id: makeId(), src }],
            }
          : step
      )
    );
  };

  const removeScreenshotFromStep = (stepId, shotId) => {
    setSteps((cur) =>
      cur.map((step) =>
        step.id === stepId
          ? {
              ...step,
              screenshots: (step.screenshots || []).filter((shot) => shot.id !== shotId),
            }
          : step
      )
    );
  };

  const captureStepScreenshot = async (stepId) => {
    setCaptureError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        addScreenshotToStep(stepId, dataUrl);
      }
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      setCaptureError("Screenshot capture was blocked or cancelled.");
    }
  };

  const insertRegressionBlock = (label) => {
    const block = REGRESSION_BLOCKS[label] || [];
    if (block.length === 0) return;
    setSteps((cur) => [
      ...cur,
      ...block.map((text) => ({
        id: makeId(),
        text,
        timestamp: recordingActive && timestampsEnabled ? Date.now() : null,
        screenshots: [],
      })),
    ]);
  };

  const clearSession = () => {
    setShowClearConfirm(false);
    setTitle("");
    setAccount("");
    setActual("");
    setExpected("");
    setSteps([]);
    setComposerFields({});
    setStepType("Click");
    setRecordingActive(false);
    setRecordingStart(null);
    setElapsedSeconds(0);
    setTimestampsEnabled(true);
    setCompactMode(false);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const exportText = useMemo(
    () =>
      buildExportText({
        title,
        account,
        steps,
        actual,
        expected,
        environment,
        platform,
        recordingStart,
        timestampsEnabled,
      }),
    [title, account, steps, actual, expected, environment, platform, recordingStart, timestampsEnabled]
  );

  const copyExport = async () => {
    if (!exportText.trim()) return;
    await navigator.clipboard.writeText(exportText);
  };

  const downloadExport = () => {
    if (!exportText.trim()) return;
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "web-client-tester.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    steps.forEach((step, stepIndex) => {
      (step.screenshots || []).forEach((shot, shotIndex) => {
        const shotBlob = dataUrlToBlob(shot.src);
        const shotUrl = URL.createObjectURL(shotBlob);
        const shotLink = document.createElement("a");
        shotLink.href = shotUrl;
        shotLink.download = `step-${stepIndex + 1}-${shotIndex + 1}.png`;
        document.body.appendChild(shotLink);
        shotLink.click();
        document.body.removeChild(shotLink);
        URL.revokeObjectURL(shotUrl);
      });
    });
  };

  const panelClasses = darkMode
    ? "bg-gray-900/70 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const inputClasses = darkMode
    ? "bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-500"
    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-500";

  return (
    <div className="w-full flex flex-col gap-4">
      <div className={`border rounded-xl p-4 ${panelClasses}`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold">Environment</label>
          <select
            value={environment}
            onChange={(event) => handleEnvironmentChange(event.target.value)}
            className={`border rounded px-3 py-2 ${inputClasses}`}
          >
            {ENV_OPTIONS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          <label className="text-sm font-semibold">Recorder Port</label>
          <input
            type="number"
            value={wsPort}
            onChange={(event) => setWsPort(Number(event.target.value) || DEFAULT_WS_PORT)}
            className={`border rounded px-3 py-2 w-28 ${inputClasses}`}
          />
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                wsStatus === "connected"
                  ? "bg-emerald-400"
                  : wsStatus === "connecting" || wsStatus === "reconnecting"
                  ? "bg-yellow-400"
                  : "bg-gray-400"
              }`}
            />
            <span className={mutedText}>
              {wsStatus === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex-1 min-w-[240px]">
            <a
              href={environmentUrl}
              target="_blank"
              rel="noreferrer"
              className={`px-3 py-2 rounded border inline-flex items-center gap-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
            >
              <ExternalLink className="h-4 w-4" />
              Open Web Client
            </a>
          </div>
        </div>
        {wsError && <div className="mt-2 text-sm text-red-400">{wsError}</div>}
      </div>

      <div className={`border rounded-xl p-4 ${panelClasses}`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={`w-full border rounded px-3 py-2 ${inputClasses}`}
              placeholder="Bug title"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Account</label>
            <input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              className={`w-full border rounded px-3 py-2 ${inputClasses}`}
              placeholder="Account"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">Platform</label>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className={`w-full border rounded px-3 py-2 ${inputClasses}`}
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

            <div className={`border rounded-lg p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold">Steps</label>
                  {recordingActive && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400">
                      <CircleDot className="h-3 w-3" />
                      Recording Active
                    </span>
                  )}
                </div>
                <span className={`text-xs ${mutedText}`}>{steps.length} total</span>
              </div>
              <DragDropContext onDragEnd={handleStepsDrag}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2 mt-3">
                      {steps.map((step, index) => (
                        <Draggable key={step.id} draggableId={step.id} index={index}>
                          {(dragProvided) => {
                            const stepTime =
                              timestampsEnabled && recordingStart && step.timestamp
                                ? formatElapsed((step.timestamp - recordingStart) / 1000)
                                : "";
                            const stepRowClasses = `${compactMode ? "py-1" : "py-2"} ${
                              activeStepId === step.id
                                ? darkMode
                                  ? "ring-2 ring-blue-400/60"
                                  : "ring-2 ring-blue-400/40"
                                : ""
                            }`;
                            return (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`flex items-start gap-2 border rounded px-2 ${stepRowClasses} ${darkMode ? "border-gray-700" : "border-gray-200"}`}
                              >
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className={`cursor-grab ${mutedText}`}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className={`text-xs ${mutedText}`}>{index + 1}.</span>
                                <input
                                  value={step.text}
                                  onChange={(event) => updateStep(step.id, event.target.value)}
                                  onKeyDown={(event) => handleStepKey(event, index)}
                                  onFocus={() => setActiveStepId(step.id)}
                                  ref={(node) => {
                                    if (node) stepInputRefs.current[step.id] = node;
                                    else delete stepInputRefs.current[step.id];
                                  }}
                                  placeholder="Step description"
                                  className={`flex-1 border rounded px-3 py-2 ${inputClasses}`}
                                />
                                {stepTime && (
                                  <span className={`text-xs ${mutedText}`}>{stepTime}</span>
                                )}
                                <button
                                  onClick={() => captureStepScreenshot(step.id)}
                                  title="Capture screenshot"
                                  className={`p-1 rounded ${darkMode ? "text-gray-400 hover:text-gray-200" : "text-blue-500 hover:text-blue-700"}`}
                                >
                                  <Camera className="h-4 w-4" />
                                </button>
                                <button onClick={() => removeStep(step.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </button>
                              </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {captureError && <div className="mt-2 text-sm text-red-400">{captureError}</div>}
              {steps.map((step) => (
                step.screenshots?.length > 0 ? (
                  <div key={`${step.id}-shots`} className="mt-3 ml-6 flex flex-wrap gap-2">
                    {step.screenshots.map((shot) => (
                      <div key={shot.id} className="relative">
                        <img
                          src={shot.src}
                          alt="Step screenshot"
                          className="h-24 w-32 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeScreenshotFromStep(step.id, shot.id)}
                          className="absolute -top-2 -right-2 bg-white rounded-full border shadow"
                          aria-label="Remove screenshot"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Actual Result</label>
                <textarea
                  value={actual}
                  onChange={(event) => setActual(event.target.value)}
                  className={`w-full border rounded px-3 py-2 min-h-[120px] ${inputClasses}`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Expected Result</label>
                <textarea
                  value={expected}
                  onChange={(event) => setExpected(event.target.value)}
                  className={`w-full border rounded px-3 py-2 min-h-[120px] ${inputClasses}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyExport}
                className={`px-3 py-2 rounded border inline-flex items-center gap-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                <Copy className="h-4 w-4" />
                Copy Output
              </button>
              <button
                onClick={downloadExport}
                className={`px-3 py-2 rounded border inline-flex items-center gap-2 ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                <Download className="h-4 w-4" />
                Download .txt
              </button>
            </div>
          </div>
        </div>

      {showClearConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md ${panelClasses}`}>
            <h3 className="text-lg font-semibold mb-2">Clear session?</h3>
            <p className={`text-sm mb-4 ${mutedText}`}>
              This will remove all steps and inputs from this session.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className={`px-3 py-2 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                Cancel
              </button>
              <button
                onClick={clearSession}
                className="px-3 py-2 rounded bg-red-500 text-white"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
