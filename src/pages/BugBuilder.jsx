import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  PlusCircle,
  Trash2,
  GripVertical,
  Copy,
  ClipboardList,
  X,
  AlertTriangle,
  Mic,
  MicOff,
} from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";
const STORAGE_KEY = "bugBuilderDraft";

const makeId = () => Math.random().toString(36).slice(2, 10);

const defaultDraft = {
  title: "",
  steps: [{ id: makeId(), text: "", images: [] }],
  actual: "",
  expected: "",
  actualImages: [],
  expectedImages: [],
  formName: "",
  jobTypeName: "",
  jobId: "",
  account: "",
  password: "",
  mobileUser: "",
  mobilePassword: "",
};

const normalizeDraft = (draft) => ({
  ...defaultDraft,
  ...draft,
  steps: (draft?.steps || defaultDraft.steps).map((step) => ({
    ...step,
    images: step?.images || [],
  })),
  actualImages: draft?.actualImages || [],
  expectedImages: draft?.expectedImages || [],
});

const buildBugText = (draft) => {
  const lines = [];
  const pushSection = (sectionLines) => {
    if (sectionLines.length === 0) return;
    if (lines.length > 0) lines.push("");
    lines.push(...sectionLines);
  };

  const creds = [];
  if (draft.account) creds.push(`Account: ${draft.account}`);
  if (draft.password) creds.push(`Password: ${draft.password}`);
  if (draft.mobileUser) creds.push(`Mobile User: ${draft.mobileUser}`);
  if (draft.mobilePassword) creds.push(`Mobile Password: ${draft.mobilePassword}`);
  pushSection(creds);


  const detailLines = [];
  if (draft.formName) detailLines.push(`Form Name: ${draft.formName}`);
  if (draft.jobTypeName) detailLines.push(`Job Type Name: ${draft.jobTypeName}`);
  if (draft.jobId) detailLines.push(`Job ID: ${draft.jobId}`);
  pushSection(detailLines);

  const stepLines = draft.steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .map((step, index) => `${index + 1}. ${step}`);
  if (stepLines.length > 0) {
    pushSection(["Steps:", ...stepLines]);
  }

  if (draft.actual) {
    pushSection(["Actual Result:", draft.actual]);
  }

  if (draft.expected) {
    pushSection(["Expected Result:", draft.expected]);
  }

  return lines.join("\n");
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildBugHtml = (draft) => {
  const blocks = [];
  const addBlock = (content) => {
    if (!content) return;
    blocks.push(content);
  };

  const credentialLines = [];
  if (draft.account) {
    credentialLines.push(`<div><strong>Account:</strong> ${escapeHtml(draft.account)}</div>`);
  }
  if (draft.password) {
    credentialLines.push(`<div><strong>Password:</strong> ${escapeHtml(draft.password)}</div>`);
  }
  if (draft.mobileUser) {
    credentialLines.push(`<div><strong>Mobile User:</strong> ${escapeHtml(draft.mobileUser)}</div>`);
  }
  if (draft.mobilePassword) {
    credentialLines.push(`<div><strong>Mobile Password:</strong> ${escapeHtml(draft.mobilePassword)}</div>`);
  }
  if (credentialLines.length > 0) {
    addBlock(credentialLines.join(""));
  }


  const detailBlocks = [];
  if (draft.formName) {
    detailBlocks.push(`<div><strong>Form Name:</strong> ${escapeHtml(draft.formName)}</div>`);
  }
  if (draft.jobTypeName) {
    detailBlocks.push(`<div><strong>Job Type Name:</strong> ${escapeHtml(draft.jobTypeName)}</div>`);
  }
  if (draft.jobId) {
    detailBlocks.push(`<div><strong>Job ID:</strong> ${escapeHtml(draft.jobId)}</div>`);
  }
  if (detailBlocks.length > 0) {
    addBlock(detailBlocks.join(""));
  }

  const stepItems = draft.steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .map((step) => `<li>${escapeHtml(step)}</li>`);
  if (stepItems.length > 0) {
    addBlock(`<div><strong>Steps:</strong></div><ol>${stepItems.join("")}</ol>`);
  }

  const stepImageItems = draft.steps
    .flatMap((step, index) =>
      (step.images || []).map(
        (img) =>
          `<div><strong>Step ${index + 1} Screenshot:</strong></div><div><img src="${img.src}" alt="Step ${index + 1} screenshot" style="max-width: 520px; height: auto;"/></div>`
      )
    );
  stepImageItems.forEach((item) => addBlock(item));

  if (draft.actual) {
    addBlock(`<div><strong>Actual Result:</strong></div><div>${escapeHtml(draft.actual)}</div>`);
  }

  if (draft.actualImages.length > 0) {
    const actualImages = draft.actualImages
      .map(
        (img) =>
          `<div><img src="${img.src}" alt="Actual result screenshot" style="max-width: 520px; height: auto;"/></div>`
      )
      .join("");
    addBlock(`<div><strong>Actual Result Screenshots:</strong></div>${actualImages}`);
  }

  if (draft.expected) {
    addBlock(`<div><strong>Expected Result:</strong></div><div>${escapeHtml(draft.expected)}</div>`);
  }

  if (draft.expectedImages.length > 0) {
    const expectedImages = draft.expectedImages
      .map(
        (img) =>
          `<div><img src="${img.src}" alt="Expected result screenshot" style="max-width: 520px; height: auto;"/></div>`
      )
      .join("");
    addBlock(`<div><strong>Expected Result Screenshots:</strong></div>${expectedImages}`);
  }

  return blocks.join("<br/>");
};

const copyHtmlWithFallback = async (html, text) => {
  if (navigator.clipboard.write && window.ClipboardItem) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return true;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);

  const selection = window.getSelection();
  if (!selection) {
    document.body.removeChild(container);
    return false;
  }
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection.addRange(range);

  const copied = document.execCommand("copy");
  selection.removeAllRanges();
  document.body.removeChild(container);
  return copied;
};

const parseTranscript = (raw) => {
  const text = raw.replace(/\s+/g, " ").trim();
  const markerRegex = /(account|username|password|mobile user|mobile password|form name|job type name|job id|steps|actual result|expected result)\s*(?:[:\-]|is\b)?\s*/gi;
  const matches = [];
  let match;
  while ((match = markerRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      label: match[1].toLowerCase(),
      length: match[0].length,
    });
  }

  const sections = {};
  const normalizeLabel = (label) => {
    if (label === "username" || label === "account") return "account";
    if (label === "password") return "password";
    if (label === "mobile user") return "mobileUser";
    if (label === "mobile password") return "mobilePassword";
    if (label === "form name") return "formName";
    if (label === "job type name") return "jobTypeName";
    if (label === "job id") return "jobId";
    if (label === "steps") return "steps";
    if (label === "actual result") return "actual";
    if (label === "expected result") return "expected";
    return null;
  };

  matches.forEach((item, index) => {
    const nextIndex = matches[index + 1]?.index ?? text.length;
    const value = text.slice(item.index + item.length, nextIndex).trim();
    const key = normalizeLabel(item.label);
    if (key && value) sections[key] = value;
  });

  if (sections.steps) {
    const numbered = sections.steps
      .split(/\s*\d+[\).:-]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    const fallback = sections.steps
      .split(/\s*;\s*|\s*\n\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    sections.steps = numbered.length > 1 ? numbered : fallback;
  } else {
    const stepMatches = Array.from(
      text.matchAll(/step\s*\d+\s*[:\).\-]?\s*([^\n\.]+)/gi)
    );
    if (stepMatches.length > 0) {
      sections.steps = stepMatches.map((item) => item[1].trim()).filter(Boolean);
    }
  }

  return sections;
};

export default function BugBuilderPage() {
  const { darkMode } = useContext(DarkModeContext) || {};
  const [draft, setDraft] = useState(defaultDraft);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const loadedRef = useRef(false);
  const stepInputRefs = useRef({});
  const focusStepIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setDraft(normalizeDraft(parsed));
      } catch {
        setDraft(defaultDraft);
      }
    }
    setDirty(false);
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setDirty(true);
  }, [draft]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));
  }, []);

  useEffect(() => {
    if (!focusStepIdRef.current) return;
    const targetId = focusStepIdRef.current;
    focusStepIdRef.current = null;
    requestAnimationFrame(() => {
      stepInputRefs.current[targetId]?.focus();
    });
  }, [draft.steps]);

  const previewText = useMemo(() => buildBugText(draft), [draft]);

  const setField = (field, value) => {
    setDraft((cur) => ({ ...cur, [field]: value }));
  };

  const addStep = () => {
    setDraft((cur) => ({
      ...cur,
      steps: [...cur.steps, { id: makeId(), text: "", images: [] }],
    }));
  };

  const insertStepAfter = (index) => {
    const newId = makeId();
    focusStepIdRef.current = newId;
    setDraft((cur) => {
      const updated = [...cur.steps];
      updated.splice(index + 1, 0, { id: newId, text: "", images: [] });
      return { ...cur, steps: updated };
    });
  };

  const addImageToStep = (stepId, src) => {
    setDraft((cur) => ({
      ...cur,
      steps: cur.steps.map((step) =>
        step.id === stepId
          ? { ...step, images: [...(step.images || []), { id: makeId(), src }] }
          : step
      ),
    }));
  };

  const removeStepImage = (stepId, imageId) => {
    setDraft((cur) => ({
      ...cur,
      steps: cur.steps.map((step) =>
        step.id === stepId
          ? { ...step, images: (step.images || []).filter((img) => img.id !== imageId) }
          : step
      ),
    }));
  };

  const addActualImage = (src) => {
    setDraft((cur) => ({
      ...cur,
      actualImages: [...cur.actualImages, { id: makeId(), src }],
    }));
  };

  const removeActualImage = (imageId) => {
    setDraft((cur) => ({
      ...cur,
      actualImages: cur.actualImages.filter((img) => img.id !== imageId),
    }));
  };

  const addExpectedImage = (src) => {
    setDraft((cur) => ({
      ...cur,
      expectedImages: [...cur.expectedImages, { id: makeId(), src }],
    }));
  };

  const removeExpectedImage = (imageId) => {
    setDraft((cur) => ({
      ...cur,
      expectedImages: cur.expectedImages.filter((img) => img.id !== imageId),
    }));
  };

  const handlePasteImages = (event, onImage) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    event.preventDefault();
    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const updateStep = (id, value) => {
    setDraft((cur) => ({
      ...cur,
      steps: cur.steps.map((step) => (step.id === id ? { ...step, text: value } : step)),
    }));
  };

  const removeStep = (id) => {
    setDraft((cur) => ({
      ...cur,
      steps: cur.steps.filter((step) => step.id !== id),
    }));
  };

  const handleStepsDrag = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(draft.steps);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setDraft((cur) => ({ ...cur, steps: reordered }));
  };


  const copyTitle = async () => {
    if (!draft.title.trim()) return;
    await navigator.clipboard.writeText(draft.title.trim());
    setToast({ type: "success", message: "Title copied" });
  };

  const applyTranscript = (raw) => {
    const parsed = parseTranscript(raw);
    setDraft((cur) => ({
      ...cur,
      account: parsed.account ?? cur.account,
      password: parsed.password ?? cur.password,
      mobileUser: parsed.mobileUser ?? cur.mobileUser,
      mobilePassword: parsed.mobilePassword ?? cur.mobilePassword,
      formName: parsed.formName ?? cur.formName,
      jobTypeName: parsed.jobTypeName ?? cur.jobTypeName,
      jobId: parsed.jobId ?? cur.jobId,
      actual: parsed.actual ?? cur.actual,
      expected: parsed.expected ?? cur.expected,
      steps: parsed.steps?.length
        ? parsed.steps.map((text) => ({ id: makeId(), text, images: [] }))
        : cur.steps,
    }));
  };

  const toggleListening = () => {
    if (!speechSupported) {
      setToast({ type: "error", message: "Speech recognition not supported" });
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast({ type: "error", message: "Speech recognition not supported" });
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            const snippet = result[0]?.transcript?.trim();
            if (snippet) {
              transcriptRef.current += `${transcriptRef.current ? " " : ""}${snippet}`;
            }
          }
        }
      };
      recognition.onerror = () => {
        setIsListening(false);
        setToast({ type: "error", message: "Speech recognition failed" });
      };
      recognition.onend = () => {
        setIsListening(false);
        const finalText = transcriptRef.current.trim();
        if (finalText) {
          applyTranscript(finalText);
          const preview = finalText.length > 200 ? `${finalText.slice(0, 200)}...` : finalText;
          setToast({ type: "success", message: `Transcript: ${preview}` });
        }
      };
      recognitionRef.current = recognition;
    }

    transcriptRef.current = "";
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setToast({ type: "error", message: "Speech recognition unavailable" });
      setIsListening(false);
    }
  };

  const copyFullBug = async () => {
    if (!previewText.trim()) return;
    const html = buildBugHtml(draft);
    try {
      const richCopied = await copyHtmlWithFallback(html, previewText);
      if (!richCopied) {
        await navigator.clipboard.writeText(previewText);
      }
      setToast({ type: "success", message: "Bug copied" });
    } catch {
      await navigator.clipboard.writeText(previewText);
      setToast({ type: "success", message: "Bug copied" });
    }
  };


  const clearDraft = () => {
    setDraft(defaultDraft);
    localStorage.removeItem(STORAGE_KEY);
    setDirty(false);
  };

  const panelClasses = darkMode
    ? "bg-gray-900/70 border-gray-700 text-gray-100"
    : "bg-white border-gray-200 text-gray-900";
  const inputClasses = darkMode
    ? "bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-500"
    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-500";

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className={`flex-1 border rounded-xl p-4 ${panelClasses}`}>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Title</label>
                <button
                  onClick={toggleListening}
                  className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                  disabled={!speechSupported}
                  title={speechSupported ? "Speech to text" : "Speech not supported"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>
              <input
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
                className={`w-full border rounded px-3 py-2 ${inputClasses}`}
                placeholder="Bug title"
              />
            </div>

            <div className={`border rounded-lg p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="text-sm font-semibold mb-2">Credentials</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={draft.account}
                  onChange={(e) => setField("account", e.target.value)}
                  placeholder="Account"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
                <input
                  value={draft.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Password"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
                <input
                  value={draft.mobileUser}
                  onChange={(e) => setField("mobileUser", e.target.value)}
                  placeholder="Mobile User"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
                <input
                  value={draft.mobilePassword}
                  onChange={(e) => setField("mobilePassword", e.target.value)}
                  placeholder="Mobile Password"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
              </div>
            </div>

            <div className={`border rounded-lg p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="text-sm font-semibold mb-2">Form / Job Details</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={draft.formName}
                  onChange={(e) => setField("formName", e.target.value)}
                  placeholder="Form Name"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
                <input
                  value={draft.jobTypeName}
                  onChange={(e) => setField("jobTypeName", e.target.value)}
                  placeholder="Job Type Name"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
                <input
                  value={draft.jobId}
                  onChange={(e) => setField("jobId", e.target.value)}
                  placeholder="Job ID"
                  className={`border rounded px-3 py-2 ${inputClasses}`}
                />
              </div>
            </div>

            <div className={`border rounded-lg p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Steps</label>
                <button
                  onClick={addStep}
                  className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              <DragDropContext onDragEnd={handleStepsDrag}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2 mt-3">
                      {draft.steps.map((step, index) => (
                        <Draggable key={step.id} draggableId={step.id} index={index}>
                          {(dragProvided) => (
                            <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                              <div
                                className={`flex items-center gap-2 border rounded px-2 py-2 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
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
                                  onChange={(e) => updateStep(step.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      insertStepAfter(index);
                                    }
                                  }}
                                  onPaste={(e) => handlePasteImages(e, (src) => addImageToStep(step.id, src))}
                                  ref={(node) => {
                                    if (node) stepInputRefs.current[step.id] = node;
                                    else delete stepInputRefs.current[step.id];
                                  }}
                                  placeholder="Step description"
                                  className={`flex-1 border rounded px-3 py-2 ${inputClasses}`}
                                />
                                <button onClick={() => removeStep(step.id)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </button>
                              </div>
                              {step.images?.length > 0 && (
                                <div className="ml-7 mt-2 flex flex-wrap gap-2">
                                  {step.images.map((img) => (
                                    <div key={img.id} className="relative">
                                      <img
                                        src={img.src}
                                        alt="Step screenshot"
                                        className="h-24 w-32 object-cover rounded border"
                                      />
                                      <button
                                        onClick={() => removeStepImage(step.id, img.id)}
                                        className="absolute -top-2 -right-2 bg-white rounded-full border shadow"
                                        aria-label="Remove screenshot"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Actual Result</label>
                <textarea
                  value={draft.actual}
                  onChange={(e) => setField("actual", e.target.value)}
                  onPaste={(e) => handlePasteImages(e, addActualImage)}
                  className={`w-full border rounded px-3 py-2 min-h-[120px] ${inputClasses}`}
                />
                {draft.actualImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.actualImages.map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={img.src}
                          alt="Actual result screenshot"
                          className="h-24 w-32 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeActualImage(img.id)}
                          className="absolute -top-2 -right-2 bg-white rounded-full border shadow"
                          aria-label="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold">Expected Result</label>
                <textarea
                  value={draft.expected}
                  onChange={(e) => setField("expected", e.target.value)}
                  onPaste={(e) => handlePasteImages(e, addExpectedImage)}
                  className={`w-full border rounded px-3 py-2 min-h-[120px] ${inputClasses}`}
                />
                {draft.expectedImages.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.expectedImages.map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={img.src}
                          alt="Expected result screenshot"
                          className="h-24 w-32 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeExpectedImage(img.id)}
                          className="absolute -top-2 -right-2 bg-white rounded-full border shadow"
                          aria-label="Remove screenshot"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className={`flex-1 border rounded-xl p-4 ${panelClasses}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Live Preview</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyTitle}
                className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={copyFullBug}
                className={`px-2 py-1 rounded border ${darkMode ? "border-gray-700" : "border-gray-300"}`}
              >
                <ClipboardList className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[70vh] pr-2">
            <div className={`rounded-xl border p-4 ${darkMode ? "border-gray-700 bg-gray-900/60" : "border-gray-200 bg-white"}`}>
              <div className="space-y-4 text-sm">
                {draft.title && (
                  <div className="text-lg font-semibold">{draft.title}</div>
                )}
                {(draft.account || draft.password || draft.mobileUser || draft.mobilePassword) && (
                  <div className="space-y-1">
                    {draft.account && (
                      <div>
                        <span className="font-semibold">Account:</span> {draft.account}
                      </div>
                    )}
                    {draft.password && (
                      <div>
                        <span className="font-semibold">Password:</span> {draft.password}
                      </div>
                    )}
                    {draft.mobileUser && (
                      <div>
                        <span className="font-semibold">Mobile User:</span> {draft.mobileUser}
                      </div>
                    )}
                    {draft.mobilePassword && (
                      <div>
                        <span className="font-semibold">Mobile Password:</span> {draft.mobilePassword}
                      </div>
                    )}
                  </div>
                )}


                {draft.steps.some((step) => step.text.trim()) && (
                  <div>
                    <div className="font-semibold">Steps:</div>
                    <ol className="list-decimal pl-5">
                      {draft.steps
                        .filter((step) => step.text.trim())
                        .map((step) => (
                          <li key={step.id} className="mb-2">
                            <div>{step.text}</div>
                            {step.images?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {step.images.map((img) => (
                                  <img
                                    key={img.id}
                                    src={img.src}
                                    alt="Step screenshot"
                                    className="h-24 w-32 object-cover rounded border"
                                  />
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                    </ol>
                  </div>
                )}

                {(draft.formName || draft.jobTypeName || draft.jobId) && (
                  <div>
                    {draft.formName && (
                      <div>
                        <span className="font-semibold">Form Name:</span> {draft.formName}
                      </div>
                    )}
                    {draft.jobTypeName && (
                      <div>
                        <span className="font-semibold">Job Type Name:</span> {draft.jobTypeName}
                      </div>
                    )}
                    {draft.jobId && (
                      <div>
                        <span className="font-semibold">Job ID:</span> {draft.jobId}
                      </div>
                    )}
                  </div>
                )}

                {draft.actual && (
                  <div>
                    <div className="font-semibold">Actual Result:</div>
                    <div className="whitespace-pre-wrap">{draft.actual}</div>
                    {draft.actualImages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {draft.actualImages.map((img) => (
                          <img
                            key={img.id}
                            src={img.src}
                            alt="Actual result screenshot"
                            className="h-24 w-32 object-cover rounded border"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {draft.expected && (
                  <div>
                    <div className="font-semibold">Expected Result:</div>
                    <div className="whitespace-pre-wrap">{draft.expected}</div>
                    {draft.expectedImages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {draft.expectedImages.map((img) => (
                          <img
                            key={img.id}
                            src={img.src}
                            alt="Expected result screenshot"
                            className="h-24 w-32 object-cover rounded border"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-2 rounded shadow-lg text-sm ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-gray-900 text-white"}`}
          >
            {toast.message}
            <button onClick={() => setToast(null)} className="ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
