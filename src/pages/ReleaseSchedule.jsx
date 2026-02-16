import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  CalendarDays,
  PlusCircle,
  Pencil,
  Trash2,
  List,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Download,
} from "lucide-react";
import { DarkModeContext } from "../AppRoutes.jsx";

const STORAGE_KEYS = {
  streams: "releaseStreams",
  releases: "releaseItems",
};

const DEFAULT_STREAMS = [
  { id: "stream-workmobile", name: "WorkMobile", color: "#7DD3FC" },
  { id: "stream-rlb", name: "RLB", color: "#1D4ED8" },
];

const SYSTEM_OPTIONS = [
  "Website",
  "WMBAPI",
  "API2",
  "WM2 Portal",
  "Web Client",
  "Xamarin Android",
  "Xamarin iOS",
  "MAUI",
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

const stripHtml = (value) => (value || "").replace(/<[^>]*>/g, " ");

const normalizeSystemName = (system) => {
  if (system === "Xamarin") return "Xamarin Android";
  return system || "";
};

const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (iso) => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const diffInDays = (fromIso, toIso) => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
};

const formatDayCount = (days, suffix = "") => {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Today";
  if (days === 1) return `1 day${suffix}`;
  return `${days} days${suffix}`;
};

const sanitizeFileName = (value) =>
  String(value || "Customer")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatDateLabel = (iso) => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMonthLabel = (date) =>
  date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const startOfMonthGrid = (date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);
  return gridStart;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toIso = (date) => date.toISOString().slice(0, 10);

const normalizeVersions = (versions) => {
  if (Array.isArray(versions)) {
    return versions
      .map((version) => ({
        system: normalizeSystemName(version?.system),
        version: version?.version || "",
      }))
      .filter((version) => version.system && version.version);
  }

  if (versions && typeof versions === "object") {
    const legacy = [
      { system: "Website", version: versions.website },
      { system: "Xamarin Android", version: versions.android },
      { system: "Xamarin iOS", version: versions.ios },
    ];
    return legacy.filter((version) => version.version);
  }

  return [];
};

const normalizeContents = (contents) => {
  if (Array.isArray(contents)) {
    return contents
      .map((section) => ({
        system: normalizeSystemName(section?.system),
        items: Array.isArray(section?.items) ? section.items : [],
        features: Array.isArray(section?.features) ? section.features : [],
        bugs: Array.isArray(section?.bugs) ? section.bugs : [],
      }))
      .map((section) => {
        const features = section.items
          .filter((item) => item?.type === "Feature")
          .map((item) => item?.text || "")
          .concat(section.features || [])
          .map((text) => String(text || "").trim())
          .filter(Boolean);
        const bugs = section.items
          .filter((item) => item?.type === "Bug")
          .map((item) => item?.text || "")
          .concat(section.bugs || [])
          .map((text) => String(text || "").trim())
          .filter(Boolean);
        return {
          system: section.system,
          features,
          bugs,
        };
      })
      .filter((section) => section.system && (section.features.length > 0 || section.bugs.length > 0));
  }

  if (typeof contents === "string") {
    const text = stripHtml(contents).trim();
    if (!text) return [];
    return [
      {
        system: "Website",
        features: [text],
        bugs: [],
      },
    ];
  }

  return [];
};

const normalizeRelease = (release) => ({
  ...release,
  id: String(release?.id ?? makeId()),
  name: release?.name || "",
  date: release?.date || "",
  versions: normalizeVersions(release?.versions),
  contents: normalizeContents(release?.contents),
  attachments: Array.isArray(release?.attachments) ? release.attachments : [],
  streamId: release?.streamId || DEFAULT_STREAMS[0].id,
});

const formatVersionLabel = (version) => `${version.system} v${version.version}`;

export default function ReleaseSchedulePage() {
  const { darkMode } = useContext(DarkModeContext) || {};

  const [streams, setStreams] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.streams);
    const parsed = safeParse(raw, DEFAULT_STREAMS);
    return parsed.length ? parsed : DEFAULT_STREAMS;
  });

  const [releases, setReleases] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.releases);
    const parsed = safeParse(raw, []);
    return parsed.map(normalizeRelease);
  });

  const [activeStreamId, setActiveStreamId] = useState(() => DEFAULT_STREAMS[0].id);
  const [viewMode, setViewMode] = useState("list");
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [groupByMonth, setGroupByMonth] = useState(true);
  const moreMenuRef = useRef(null);
  const [collapsedReleaseIds, setCollapsedReleaseIds] = useState(() => ({}));

  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamModalMode, setStreamModalMode] = useState("add");
  const [streamDraftName, setStreamDraftName] = useState("");
  const [streamDraftColor, setStreamDraftColor] = useState("#60A5FA");
  const [streamEditId, setStreamEditId] = useState(null);

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [editingReleaseId, setEditingReleaseId] = useState(null);
  const [initialReleaseDraft, setInitialReleaseDraft] = useState(null);
  const [showReleaseCloseConfirm, setShowReleaseCloseConfirm] = useState(false);
  const [releaseDraft, setReleaseDraft] = useState({
    name: "",
    date: "",
    contents: [],
    versions: [],
    attachments: [],
    streamId: DEFAULT_STREAMS[0].id,
  });
  const attachmentInputRef = useRef(null);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.streams, JSON.stringify(streams));
  }, [streams]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.releases, JSON.stringify(releases));
  }, [releases]);

  useEffect(() => {
    if (!streams.find((s) => s.id === activeStreamId)) {
      setActiveStreamId(streams[0]?.id || DEFAULT_STREAMS[0].id);
    }
  }, [streams, activeStreamId]);

  const filteredReleases = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return releases
      .filter((r) => r.streamId === activeStreamId)
      .filter((r) => {
        if (!text) return true;
        const versionsText = (r.versions || [])
          .map((version) => `${version.system} ${version.version}`)
          .join(" ");
        const contentsText = (r.contents || [])
          .flatMap((section) => [
            ...(section.features || []).map((text) => `${section.system} feature ${text}`),
            ...(section.bugs || []).map((text) => `${section.system} bug ${text}`),
          ])
          .join(" ");
        const haystack = [
          r.name,
          r.date,
          versionsText,
          contentsText,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(text);
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [releases, activeStreamId, searchText]);

  const groupedReleases = useMemo(() => {
    if (!groupByMonth) return { All: filteredReleases };
    return filteredReleases.reduce((acc, release) => {
      const [year, month] = release.date.split("-");
      const key = `${year}-${month}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(release);
      return acc;
    }, {});
  }, [filteredReleases, groupByMonth]);

  const buildComparableDraft = (draft) => ({
    name: draft?.name || "",
    date: draft?.date || "",
    streamId: draft?.streamId || "",
    versions: (draft?.versions || []).map((version) => ({
      system: normalizeSystemName(version.system),
      version: version.version || "",
    })),
    contents: (draft?.contents || []).map((section) => ({
      system: normalizeSystemName(section.system),
      features: (section.features || []).map((text) => String(text || "")),
      bugs: (section.bugs || []).map((text) => String(text || "")),
    })),
    attachments: (draft?.attachments || []).map((att) => ({
      id: att.id,
      name: att.name,
      size: att.size,
      type: att.type,
      dataUrl: att.dataUrl,
    })),
  });

  const isReleaseDirty = useMemo(() => {
    if (!initialReleaseDraft) return false;
    const current = buildComparableDraft(releaseDraft);
    return JSON.stringify(current) !== JSON.stringify(initialReleaseDraft);
  }, [initialReleaseDraft, releaseDraft]);

  const requestCloseReleaseModal = () => {
    if (!isReleaseDirty) {
      setShowReleaseModal(false);
      setShowReleaseCloseConfirm(false);
      setInitialReleaseDraft(null);
      setEditingReleaseId(null);
      return;
    }
    setShowReleaseCloseConfirm(true);
  };

  useEffect(() => {
    if (!showReleaseModal) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        requestCloseReleaseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReleaseModal, isReleaseDirty]);

  useEffect(() => {
    if (!showMoreActions) return undefined;
    const handleOutsideClick = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreActions(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showMoreActions]);

  const openStreamModal = (mode, stream) => {
    setStreamModalMode(mode);
    setShowStreamModal(true);
    if (mode === "rename" && stream) {
      setStreamDraftName(stream.name);
      setStreamDraftColor(stream.color);
      setStreamEditId(stream.id);
    } else {
      setStreamDraftName("");
      setStreamDraftColor("#60A5FA");
      setStreamEditId(null);
    }
  };

  const saveStream = () => {
    const name = streamDraftName.trim();
    if (!name) return;
    if (streamModalMode === "rename" && streamEditId) {
      setStreams((cur) =>
        cur.map((s) => (s.id === streamEditId ? { ...s, name, color: streamDraftColor } : s))
      );
    } else {
      const newStream = { id: makeId(), name, color: streamDraftColor };
      setStreams((cur) => [...cur, newStream]);
      setActiveStreamId(newStream.id);
    }
    setShowStreamModal(false);
  };

  const deleteStream = (streamId) => {
    if (streams.length <= 1) return;
    const nextStreamId = streams.find((s) => s.id !== streamId)?.id;
    setStreams((cur) => cur.filter((s) => s.id !== streamId));
    setReleases((cur) =>
      cur.map((r) => (r.streamId === streamId ? { ...r, streamId: nextStreamId } : r))
    );
    setActiveStreamId(nextStreamId);
  };

  const openReleaseModal = (release) => {
    if (release) {
      setEditingReleaseId(release.id);
      const nextDraft = {
        name: release.name,
        date: release.date,
        contents: (release.contents || []).map((section) => ({
          system: normalizeSystemName(section.system),
          features: Array.isArray(section.features) ? [...section.features] : [],
          bugs: Array.isArray(section.bugs) ? [...section.bugs] : [],
        })),
        versions: (release.versions || []).map((version) => ({
          ...version,
          system: normalizeSystemName(version.system),
        })),
        attachments: release.attachments,
        streamId: release.streamId,
      };
      setReleaseDraft(nextDraft);
      setInitialReleaseDraft(buildComparableDraft(nextDraft));
    } else {
      setEditingReleaseId(null);
      const nextDraft = {
        name: "",
        date: "",
        contents: [],
        versions: [],
        attachments: [],
        streamId: activeStreamId,
      };
      setReleaseDraft(nextDraft);
      setInitialReleaseDraft(buildComparableDraft(nextDraft));
    }
    setShowReleaseCloseConfirm(false);
    setShowReleaseModal(true);
  };

  const saveRelease = () => {
    const name = releaseDraft.name.trim();
    if (!name || !releaseDraft.date) return;

    const cleanedVersions = (releaseDraft.versions || [])
      .map((version) => ({
        system: version.system,
        version: (version.version || "").trim(),
      }))
      .filter((version) => version.system && version.version);

    const cleanedContents = (releaseDraft.contents || [])
      .map((section) => ({
        system: section.system,
        features: (section.features || [])
          .map((text) => String(text || "").trim())
          .filter(Boolean),
        bugs: (section.bugs || [])
          .map((text) => String(text || "").trim())
          .filter(Boolean),
      }))
      .filter(
        (section) =>
          section.system && (section.features.length > 0 || section.bugs.length > 0)
      );

    const payload = {
      ...releaseDraft,
      name,
      versions: cleanedVersions,
      contents: cleanedContents,
    };

    if (editingReleaseId) {
      setReleases((cur) =>
        cur.map((r) =>
          r.id === editingReleaseId ? { ...payload, id: editingReleaseId } : r
        )
      );
    } else {
      setReleases((cur) => [
        { ...payload, id: makeId(), createdAt: Date.now() },
        ...cur,
      ]);
    }
    setShowReleaseModal(false);
    setShowReleaseCloseConfirm(false);
    setInitialReleaseDraft(null);
  };

  const handleAttachmentsChange = async (files) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const converted = await Promise.all(
      list.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: makeId(),
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: reader.result,
              });
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setReleaseDraft((cur) => ({
      ...cur,
      attachments: [...cur.attachments, ...converted],
    }));
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const removeAttachment = (attachmentId) => {
    setReleaseDraft((cur) => ({
      ...cur,
      attachments: cur.attachments.filter((att) => att.id !== attachmentId),
    }));
  };

  const addVersionField = () => {
    setReleaseDraft((cur) => {
      const used = cur.versions.map((version) => version.system);
      const nextSystem = SYSTEM_OPTIONS.find((system) => !used.includes(system));
      if (!nextSystem) return cur;
      return {
        ...cur,
        versions: [...cur.versions, { system: nextSystem, version: "" }],
      };
    });
  };

  const updateVersionField = (index, field, value) => {
    setReleaseDraft((cur) => {
      const versions = cur.versions.map((version, idx) => ({ ...version }));
      if (!versions[index]) return cur;
      if (field === "system") {
        const used = versions
          .filter((_, idx) => idx !== index)
          .map((version) => version.system);
        if (used.includes(value)) return cur;
      }
      versions[index][field] = value;
      return { ...cur, versions };
    });
  };

  const removeVersionField = (index) => {
    setReleaseDraft((cur) => ({
      ...cur,
      versions: cur.versions.filter((_, idx) => idx !== index),
    }));
  };

  const addContentSection = () => {
    setReleaseDraft((cur) => {
      const used = cur.contents.map((section) => section.system);
      const nextSystem = SYSTEM_OPTIONS.find((system) => !used.includes(system));
      if (!nextSystem) return cur;
      return {
        ...cur,
        contents: [...cur.contents, { system: nextSystem, features: [], bugs: [] }],
      };
    });
  };

  const updateContentSectionSystem = (index, system) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      if (!contents[index]) return cur;
      const used = contents
        .filter((_, idx) => idx !== index)
        .map((section) => section.system);
      if (used.includes(system)) return cur;
      contents[index].system = system;
      return { ...cur, contents };
    });
  };

  const addFeatureItem = (sectionIndex) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section) return cur;
      section.features.push("");
      return { ...cur, contents };
    });
  };

  const addBugItem = (sectionIndex) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section) return cur;
      section.bugs.push("");
      return { ...cur, contents };
    });
  };

  const updateFeatureItem = (sectionIndex, itemIndex, value) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section || section.features[itemIndex] === undefined) return cur;
      section.features[itemIndex] = value;
      return { ...cur, contents };
    });
  };

  const updateBugItem = (sectionIndex, itemIndex, value) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section || section.bugs[itemIndex] === undefined) return cur;
      section.bugs[itemIndex] = value;
      return { ...cur, contents };
    });
  };

  const removeFeatureItem = (sectionIndex, itemIndex) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section) return cur;
      section.features = section.features.filter((_, idx) => idx !== itemIndex);
      return { ...cur, contents };
    });
  };

  const removeBugItem = (sectionIndex, itemIndex) => {
    setReleaseDraft((cur) => {
      const contents = cur.contents.map((section) => ({
        ...section,
        features: [...(section.features || [])],
        bugs: [...(section.bugs || [])],
      }));
      const section = contents[sectionIndex];
      if (!section) return cur;
      section.bugs = section.bugs.filter((_, idx) => idx !== itemIndex);
      return { ...cur, contents };
    });
  };

  const removeContentSection = (sectionIndex) => {
    setReleaseDraft((cur) => ({
      ...cur,
      contents: cur.contents.filter((_, idx) => idx !== sectionIndex),
    }));
  };

  const toggleReleaseCollapse = (releaseId) => {
    setCollapsedReleaseIds((cur) => ({
      ...cur,
      [releaseId]: !cur[releaseId],
    }));
  };

  const exportCustomerReleases = () => {
    const customer = streams.find((stream) => stream.id === activeStreamId);
    const customerName = customer?.name || "Customer";
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = String(today.getFullYear());
    const fileName = `${sanitizeFileName(customerName)}_ReleaseSchedule_${day}${month}${year}.json`;
    const payload = {
      customer: customerName,
      exportedAt: today.toISOString(),
      releases: filteredReleases.map((release) => ({
        name: release.name,
        date: release.date,
        versions: release.versions,
        contents: release.contents,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const loadHtml2Pdf = () =>
    new Promise((resolve, reject) => {
      if (window.html2pdf) {
        resolve(window.html2pdf);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.14.0/dist/html2pdf.bundle.min.js";
      script.async = true;
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => reject(new Error("Failed to load PDF exporter"));
      document.body.appendChild(script);
    });

  const exportCustomerPdf = async () => {
    const html2pdf = await loadHtml2Pdf();
    const customer = streams.find((stream) => stream.id === activeStreamId);
    const customerName = customer?.name || "Customer";
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = String(today.getFullYear());
    const fileName = `${sanitizeFileName(customerName)}_ReleaseSchedule_${day}${month}${year}.pdf`;

    const releasesForCustomer = [...filteredReleases].sort((a, b) =>
      a.date < b.date ? 1 : -1
    );

    const container = document.createElement("div");
    container.style.padding = "24px";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.color = "#111827";

    const versionList = (versions) =>
      versions.length
        ? `<div style="margin-top: 6px; font-size: 12px; color: #4b5563;">${versions
            .map((version) => `${version.system} v${version.version}`)
            .join(" | ")}</div>`
        : "";

    const contentBlocks = (contents) =>
      contents
        .filter((section) => (section.features || []).length > 0 || (section.bugs || []).length > 0)
        .map((section) => {
          const features = (section.features || [])
            .map((text) => `<li style="margin: 4px 0;">${text}</li>`)
            .join("");
          const bugs = (section.bugs || [])
            .map((text) => `<li style="margin: 4px 0;">${text}</li>`)
            .join("");
          return `
            <div style="margin-top: 12px;">
              <div style="font-weight: 600; margin-bottom: 6px;">${section.system}</div>
              ${features ? `<div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Features</div><ul style="margin: 6px 0 10px 18px; padding: 0;">${features}</ul>` : ""}
              ${bugs ? `<div style="font-size: 12px; text-transform: uppercase; color: #6b7280;">Bugs</div><ul style="margin: 6px 0 0 18px; padding: 0;">${bugs}</ul>` : ""}
            </div>
          `;
        })
        .join("");

    const releaseBlocks = releasesForCustomer
      .map((release) => {
        const dateLabel = formatDateLabel(release.date);
        return `
          <div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 16px; font-weight: 700;">${release.name}</div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${dateLabel}</div>
            ${versionList(release.versions || [])}
            ${contentBlocks(release.contents || [])}
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <div style="margin-bottom: 18px;">
        <div style="font-size: 20px; font-weight: 700;">${customerName} Release Schedule</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Exported ${today.toLocaleString()}</div>
      </div>
      ${releaseBlocks || "<div>No releases found.</div>"}
    `;

    html2pdf()
      .set({
        margin: 0.5,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const releaseId = result.draggableId;
    const newDate = result.destination.droppableId;
    if (result.source.droppableId === newDate) return;
    setReleases((cur) =>
      cur.map((r) => (r.id === releaseId ? { ...r, date: newDate } : r))
    );
  };

  const streamInsights = useMemo(() => {
    const now = new Date();
    const todayLocal = toLocalDateKey(now);
    const cutoffReached = now.getHours() >= 17;

    const streamReleases = releases
      .filter((r) => r.streamId === activeStreamId)
      .sort((a, b) => {
        if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
        return a.date < b.date ? -1 : 1;
      });

    const todayRelease = streamReleases.find((r) => r.date === todayLocal) || null;
    const pastReleases = streamReleases.filter((r) => r.date < todayLocal);
    const futureReleases = streamReleases.filter((r) => r.date > todayLocal);

    const nextRelease = !cutoffReached && todayRelease
      ? todayRelease
      : futureReleases[0] || null;
    const pastRelease = cutoffReached && todayRelease
      ? todayRelease
      : pastReleases[pastReleases.length - 1] || null;

    const nextLabel = nextRelease
      ? formatDayCount(diffInDays(todayLocal, nextRelease.date))
      : null;
    const pastLabel = pastRelease
      ? formatDayCount(diffInDays(pastRelease.date, todayLocal), " ago")
      : null;

    return { next: nextRelease, past: pastRelease, nextLabel, pastLabel };
  }, [releases, activeStreamId]);

  const pageClasses = darkMode ? "text-white" : "text-gray-900";
  const panelClasses = darkMode
    ? "rounded-xl p-4 shadow-inner transition bg-gray-800"
    : "rounded-xl p-4 shadow-inner transition bg-gray-50";
  const softPanelClasses = darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const modalClasses = darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const mutedText = darkMode ? "text-gray-400" : "text-gray-500";
  const toolbarButton = darkMode
    ? "border-gray-700 text-gray-200 hover:bg-gray-700"
    : "border-gray-300 text-gray-700 hover:bg-gray-100";

  return (
    <div className={`w-full ${pageClasses}`}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openReleaseModal()}
              className="px-3 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              New Release
            </button>
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                setShowMoreActions(false);
              }}
              className={`px-3 py-2 rounded border flex items-center gap-2 ${toolbarButton}`}
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreActions((v) => !v)}
                className={`px-3 py-2 rounded border flex items-center gap-2 ${toolbarButton}`}
              >
                More
              </button>
              {showMoreActions && (
                <div
                  className={`absolute left-0 mt-2 w-44 border rounded shadow p-2 z-50 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"}`}
                >
                  <button
                    onClick={() => {
                      exportCustomerPdf();
                      setShowMoreActions(false);
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:opacity-80 flex items-center gap-2 ${darkMode ? "text-gray-200 hover:bg-gray-700" : "text-gray-900 hover:bg-gray-100"}`}
                  >
                    <Download className="h-4 w-4" /> Export PDF
                  </button>
                  <button
                    onClick={() => {
                      exportCustomerReleases();
                      setShowMoreActions(false);
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:opacity-80 flex items-center gap-2 ${darkMode ? "text-gray-200 hover:bg-gray-700" : "text-gray-900 hover:bg-gray-100"}`}
                  >
                    <Download className="h-4 w-4" /> Export JSON
                  </button>
                  <button
                    onClick={() => {
                      openStreamModal("add");
                      setShowMoreActions(false);
                    }}
                    className={`w-full text-left px-2 py-2 rounded hover:opacity-80 flex items-center gap-2 ${darkMode ? "text-gray-200 hover:bg-gray-700" : "text-gray-900 hover:bg-gray-100"}`}
                  >
                    <PlusCircle className="h-4 w-4" /> Add Customer
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 ${softPanelClasses}`}>
            {streams.map((stream) => (
              <div
                key={stream.id}
                className={`flex items-center gap-2 px-3 py-1 rounded-full border ${activeStreamId === stream.id ? "border-transparent" : darkMode ? "border-gray-700" : "border-gray-300"}`}
                style={{ backgroundColor: activeStreamId === stream.id ? stream.color : "transparent" }}
              >
                <button
                  onClick={() => setActiveStreamId(stream.id)}
                  className={`text-sm font-semibold ${activeStreamId === stream.id ? "text-gray-900" : mutedText}`}
                >
                  {stream.name}
                </button>
                <button
                  onClick={() => openStreamModal("rename", stream)}
                  className="text-xs"
                  title="Rename customer"
                >
                  <Pencil className={`h-3 w-3 ${activeStreamId === stream.id ? "text-gray-900" : mutedText}`} />
                </button>
                <button
                  onClick={() => deleteStream(stream.id)}
                  className="text-xs"
                  title={streams.length <= 1 ? "At least one customer required" : "Delete customer"}
                  disabled={streams.length <= 1}
                >
                  <Trash2 className={`h-3 w-3 ${streams.length <= 1 ? mutedText : activeStreamId === stream.id ? "text-gray-900" : "text-red-500"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {(searchOpen || searchText) && (
          <div className={`p-4 border rounded ${softPanelClasses} flex flex-wrap gap-3 items-center`}>
            <div className="flex items-center gap-2">
              <Search className={`h-4 w-4 ${mutedText}`} />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search releases"
                className={`border rounded px-3 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </div>
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className={`px-3 py-2 rounded border ${toolbarButton}`}
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        <div className={`p-3 border rounded ${softPanelClasses} flex flex-wrap items-center gap-3`}>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 rounded flex items-center gap-2 border ${viewMode === "list" ? "bg-blue-500 text-white border-transparent" : toolbarButton}`}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-2 rounded flex items-center gap-2 border ${viewMode === "calendar" ? "bg-blue-500 text-white border-transparent" : toolbarButton}`}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </button>
          {viewMode === "list" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={groupByMonth}
                onChange={(e) => setGroupByMonth(e.target.checked)}
              />
              Group by month
            </label>
          )}
        </div>

        <div className={`p-4 border rounded ${softPanelClasses} flex flex-wrap gap-4 items-center`}>
          <div>
            <div className={`text-sm ${mutedText}`}>Next Release</div>
            <div className="font-semibold">
              {streamInsights.next
                ? `${streamInsights.next.name} (${streamInsights.nextLabel})`
                : "None"}
            </div>
          </div>
          <div>
            <div className={`text-sm ${mutedText}`}>Last Release</div>
            <div className="font-semibold">
              {streamInsights.past
                ? `${streamInsights.past.name} (${streamInsights.pastLabel})`
                : "None"}
            </div>
          </div>
        </div>
      </div>

      {viewMode === "list" && (
        <div className="flex flex-col gap-4">
          {Object.keys(groupedReleases).length === 0 && (
            <div className={`p-4 border rounded ${softPanelClasses}`}>No releases found.</div>
          )}
          {Object.entries(groupedReleases).map(([groupKey, items]) => (
            <div key={groupKey} className={panelClasses}>
              {groupByMonth && (
                <div className="mb-3 text-sm font-semibold">
                  {formatMonthLabel(new Date(`${groupKey}-01`))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((release) => (
                  <div
                    key={release.id}
                    className={`border rounded-lg p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleReleaseCollapse(release.id)}
                        className="text-left flex-1"
                      >
                        <div className="text-lg font-semibold">{release.name}</div>
                        <div className={`text-sm ${mutedText}`}>{formatDateLabel(release.date)}</div>
                        {release.versions.length > 0 && (
                          <div className={`text-sm ${mutedText} mt-1`}>
                            {release.versions.map(formatVersionLabel).join(" · ")}
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openReleaseModal(release);
                          }}
                          className={`px-2 py-1 rounded border ${toolbarButton}`}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <div
                      className={`mt-3 overflow-hidden transition-all duration-200 ease-out ${
                        collapsedReleaseIds[release.id]
                          ? "max-h-0 opacity-0"
                          : "max-h-[1000px] opacity-100"
                      }`}
                    >
                      {release.contents.length > 0 && (
                        <div className="flex flex-col gap-4">
                          {release.contents
                            .filter(
                              (section) =>
                                (section.features || []).length > 0 ||
                                (section.bugs || []).length > 0
                            )
                            .map((section) => (
                            <div key={section.system}>
                              <div className="text-sm font-semibold">{section.system}</div>
                              {(section.features || []).length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1 text-sm">
                                  {(section.features || []).map((text, idx) => (
                                    <li key={`${section.system}-feature-${idx}`}>
                                      ✨ {text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {(section.bugs || []).length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1 text-sm">
                                  {(section.bugs || []).map((text, idx) => (
                                    <li key={`${section.system}-bug-${idx}`}>
                                      🐞 {text}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCalendarMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}
              className={`p-2 rounded border ${toolbarButton}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-lg font-semibold">{formatMonthLabel(calendarMonth)}</div>
            <button
              onClick={() => setCalendarMonth((cur) => new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}
              className={`p-2 rounded border ${toolbarButton}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 42 }).map((_, idx) => {
                const start = startOfMonthGrid(calendarMonth);
                const date = addDays(start, idx);
                const iso = toIso(date);
                const isToday = iso === todayKey();
                const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                const dayReleases = releases.filter(
                  (r) => r.streamId === activeStreamId && r.date === iso
                );

                return (
                  <Droppable droppableId={iso} key={iso}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`border rounded-lg p-2 min-h-[110px] ${darkMode ? "border-gray-700" : "border-gray-200"} ${isCurrentMonth ? "" : "opacity-60"}`}
                      >
                        <div className={`text-xs mb-2 ${isToday ? "font-semibold text-blue-500" : mutedText}`}>
                          {date.getDate()}
                        </div>
                        <div className="flex flex-col gap-1">
                          {dayReleases.map((release, index) => {
                            const isPast = release.date < todayKey();
                            const streamColor = streams.find((s) => s.id === release.streamId)?.color;
                            return (
                              <Draggable key={release.id} draggableId={String(release.id)} index={index}>
                                {(dragProvided) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    onClick={() => openReleaseModal(release)}
                                    className={`text-xs px-2 py-1 rounded border cursor-pointer ${darkMode ? "border-gray-700" : "border-gray-200"} ${isPast ? "opacity-50" : ""}`}
                                    style={{
                                      borderColor: streamColor || undefined,
                                      ...dragProvided.draggableProps.style,
                                    }}
                                  >
                                    {release.name}
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
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {showStreamModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className={`p-4 rounded-lg w-full max-w-md border ${modalClasses}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {streamModalMode === "rename" ? "Rename Customer" : "Add Customer"}
              </h3>
              <button
                onClick={() => setShowStreamModal(false)}
                className={`px-2 py-1 rounded border ${toolbarButton}`}
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <input
                value={streamDraftName}
                onChange={(e) => setStreamDraftName(e.target.value)}
                placeholder="Customer name"
                className={`border rounded px-3 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
              <div className="flex items-center gap-2">
                <span className={`text-sm ${mutedText}`}>Color</span>
                <input
                  type="color"
                  value={streamDraftColor}
                  onChange={(e) => setStreamDraftColor(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowStreamModal(false)}
                  className={`px-3 py-2 rounded border ${toolbarButton}`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveStream}
                  className="px-3 py-2 bg-emerald-500 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReleaseModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          onClick={requestCloseReleaseModal}
        >
          <div
            className={`p-4 rounded-lg w-full max-w-4xl border max-h-[85vh] overflow-hidden ${modalClasses}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {editingReleaseId ? "Edit Release" : "New Release"}
              </h3>
              <button
                onClick={requestCloseReleaseModal}
                className={`px-2 py-1 rounded border ${toolbarButton}`}
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto pr-1 max-h-[75vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold">Release Name</label>
                  <input
                    value={releaseDraft.name}
                    onChange={(e) => setReleaseDraft((cur) => ({ ...cur, name: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Release Date</label>
                  <input
                    type="date"
                    value={releaseDraft.date}
                    onChange={(e) => setReleaseDraft((cur) => ({ ...cur, date: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Customer</label>
                  <select
                    value={releaseDraft.streamId}
                    onChange={(e) => setReleaseDraft((cur) => ({ ...cur, streamId: e.target.value }))}
                    className={`w-full border rounded px-3 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                  >
                    {streams.map((stream) => (
                      <option key={stream.id} value={stream.id}>{stream.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`border rounded p-3 ${softPanelClasses}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-semibold">Version Numbers</div>
                  <button
                    onClick={addVersionField}
                    className={`px-2 py-1 rounded border ${toolbarButton}`}
                    disabled={releaseDraft.versions.length >= SYSTEM_OPTIONS.length}
                  >
                    Add Version Field
                  </button>
                </div>
                {releaseDraft.versions.length === 0 ? (
                  <div className={`text-sm ${mutedText}`}>No version fields yet.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {releaseDraft.versions.map((version, index) => (
                      <div key={`${version.system}-${index}`} className="flex flex-wrap items-center gap-2">
                        <select
                          value={version.system}
                          onChange={(e) => updateVersionField(index, "system", e.target.value)}
                          className={`border rounded px-2 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                        >
                          {SYSTEM_OPTIONS.map((system) => {
                            const usedElsewhere = releaseDraft.versions.some(
                              (entry, idx) => idx !== index && entry.system === system
                            );
                            return (
                              <option key={system} value={system} disabled={usedElsewhere}>
                                {system}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          value={version.version}
                          onChange={(e) => updateVersionField(index, "version", e.target.value)}
                          placeholder="Version"
                          className={`flex-1 border rounded px-3 py-2 min-w-[180px] ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                        />
                        <button
                          onClick={() => removeVersionField(index)}
                          className={`p-2 rounded border ${toolbarButton}`}
                          title="Remove version"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`border rounded p-3 ${softPanelClasses}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="font-semibold">Release Contents</div>
                  <button
                    onClick={addContentSection}
                    className={`px-2 py-1 rounded border ${toolbarButton}`}
                    disabled={releaseDraft.contents.length >= SYSTEM_OPTIONS.length}
                  >
                    Add Section
                  </button>
                </div>
                {releaseDraft.contents.length === 0 ? (
                  <div className={`text-sm ${mutedText}`}>No sections yet.</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {releaseDraft.contents.map((section, sectionIndex) => {
                      const features = section.features || [];
                      const bugs = section.bugs || [];
                      return (
                        <div
                          key={`${section.system}-${sectionIndex}`}
                          className={`border rounded p-3 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <select
                              value={section.system}
                              onChange={(e) => updateContentSectionSystem(sectionIndex, e.target.value)}
                              className={`border rounded px-2 py-2 ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                            >
                              {SYSTEM_OPTIONS.map((system) => {
                                const usedElsewhere = releaseDraft.contents.some(
                                  (entry, idx) => idx !== sectionIndex && entry.system === system
                                );
                                return (
                                  <option key={system} value={system} disabled={usedElsewhere}>
                                    {system}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              onClick={() => removeContentSection(sectionIndex)}
                              className={`p-2 rounded border ${toolbarButton}`}
                              title="Remove section"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {features.length === 0 && bugs.length === 0 ? (
                            <div className={`text-sm ${mutedText}`}>No items yet.</div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {features.length > 0 && (
                                <div className="flex flex-col gap-2">
                                  <div className="text-sm font-semibold">Features</div>
                                  {features.map((text, itemIndex) => (
                                    <div
                                      key={`${section.system}-feature-${itemIndex}`}
                                      className="flex flex-wrap items-center gap-2"
                                    >
                                      <input
                                        value={text}
                                        onChange={(e) => updateFeatureItem(sectionIndex, itemIndex, e.target.value)}
                                        placeholder="Feature detail"
                                        className={`flex-1 border rounded px-3 py-2 min-w-[220px] ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                                      />
                                      <button
                                        onClick={() => removeFeatureItem(sectionIndex, itemIndex)}
                                        className={`p-2 rounded border ${toolbarButton}`}
                                        title="Remove feature"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {bugs.length > 0 && (
                                <div className="flex flex-col gap-2">
                                  <div className="text-sm font-semibold">Bugs</div>
                                  {bugs.map((text, itemIndex) => (
                                    <div
                                      key={`${section.system}-bug-${itemIndex}`}
                                      className="flex flex-wrap items-center gap-2"
                                    >
                                      <input
                                        value={text}
                                        onChange={(e) => updateBugItem(sectionIndex, itemIndex, e.target.value)}
                                        placeholder="Bug fix detail"
                                        className={`flex-1 border rounded px-3 py-2 min-w-[220px] ${darkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                                      />
                                      <button
                                        onClick={() => removeBugItem(sectionIndex, itemIndex)}
                                        className={`p-2 rounded border ${toolbarButton}`}
                                        title="Remove bug"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => addFeatureItem(sectionIndex)}
                              className={`px-2 py-1 rounded border ${toolbarButton}`}
                            >
                              Add Feature
                            </button>
                            <button
                              onClick={() => addBugItem(sectionIndex)}
                              className={`px-2 py-1 rounded border ${toolbarButton}`}
                            >
                              Add Bug
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold">Attachments</label>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    onClick={() => attachmentInputRef.current?.click()}
                    className={`px-3 py-2 rounded border flex items-center gap-2 ${toolbarButton}`}
                  >
                    <Paperclip className="h-4 w-4" />
                    Add Files
                  </button>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    onChange={(e) => handleAttachmentsChange(e.target.files)}
                    className="hidden"
                  />
                </div>
                {releaseDraft.attachments.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {releaseDraft.attachments.map((att) => (
                      <div
                        key={att.id}
                        className={`flex items-center justify-between border rounded px-3 py-2 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
                      >
                        <div className="text-sm">
                          {att.name} ({Math.round(att.size / 1024)} KB)
                        </div>
                        <button
                          onClick={() => removeAttachment(att.id)}
                          className="text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={requestCloseReleaseModal}
                  className={`px-3 py-2 rounded border ${toolbarButton}`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveRelease}
                  className="px-3 py-2 bg-blue-500 text-white rounded"
                >
                  Save Release
                </button>
              </div>
            </div>
          </div>
          {showReleaseCloseConfirm && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className={`w-full max-w-md rounded-lg border p-4 shadow-lg ${modalClasses}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="text-lg font-semibold mb-2">Unsaved changes</div>
                <p className={`text-sm ${mutedText}`}>
                  You have unsaved changes. Are you sure you want to close?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowReleaseCloseConfirm(false)}
                    className={`px-3 py-2 rounded border ${toolbarButton}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowReleaseCloseConfirm(false);
                      setShowReleaseModal(false);
                      setInitialReleaseDraft(null);
                      setEditingReleaseId(null);
                    }}
                    className="px-3 py-2 rounded bg-red-500 text-white"
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
