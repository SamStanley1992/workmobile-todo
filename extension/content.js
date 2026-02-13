const CLICK_DEBOUNCE_MS = 300;
const MIN_LABEL_LENGTH = 2;
const DEBUG_COPY_TO_CLIPBOARD = true;
const DEBUG_BADGE_ID = "__recorder_debug_badge";

const ensureDebugBadge = () => {
	if (document.getElementById(DEBUG_BADGE_ID)) return;
	const badge = document.createElement("div");
	badge.id = DEBUG_BADGE_ID;
	badge.style.position = "fixed";
	badge.style.top = "12px";
	badge.style.right = "12px";
	badge.style.zIndex = "999999";
	badge.style.background = "#111827";
	badge.style.color = "#e5e7eb";
	badge.style.padding = "8px 10px";
	badge.style.borderRadius = "8px";
	badge.style.fontSize = "12px";
	badge.style.fontFamily = "Arial, sans-serif";
	badge.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
	badge.textContent = "Recorder active";
	document.documentElement.appendChild(badge);
};

const updateDebugBadge = (text) => {
	ensureDebugBadge();
	const badge = document.getElementById(DEBUG_BADGE_ID);
	if (badge) badge.textContent = text;
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", ensureDebugBadge, { once: true });
} else {
	ensureDebugBadge();
}
console.log("[Recorder] content script loaded");

const lastEventCache = new Map();
const focusValueCache = new Map();
const inputDebounceTimers = new Map();
const lastInputValueCache = new Map();
const INPUT_DEBOUNCE_MS = 600;

const normalizeText = (value) => (value || "").replace(/\s+/g, " ").trim();

const getLabelFromAria = (el) => {
	const labelledBy = el.getAttribute("aria-labelledby");
	if (labelledBy) {
		const labelEl = document.getElementById(labelledBy);
		if (labelEl) return normalizeText(labelEl.innerText || labelEl.textContent);
	}
	return normalizeText(el.getAttribute("aria-label"));
};

const getAssociatedLabel = (el) => {
	if (!el || !el.id) return "";
	const labelEl = document.querySelector(`label[for="${el.id}"]`);
	if (labelEl) return normalizeText(labelEl.innerText || labelEl.textContent);
	return "";
};

const getParentLabel = (el) => {
	const labelEl = el.closest("label");
	if (!labelEl) return "";
	return normalizeText(labelEl.innerText || labelEl.textContent);
};

const getElementLabel = (el) => {
	if (!el) return "";
	const aria = getLabelFromAria(el);
	if (aria) return aria;
	const associated = getAssociatedLabel(el);
	if (associated) return associated;
	const parent = getParentLabel(el);
	if (parent) return parent;
	const isFieldInput = el instanceof HTMLInputElement
		|| el instanceof HTMLTextAreaElement
		|| el instanceof HTMLSelectElement;
	if (isFieldInput) {
		const wrapper = el.closest(".field-input-row, .field-wrapper, .form-field, .form-row")
			|| el.parentElement;
		if (wrapper) {
			const labelEl = wrapper.querySelector("label, .field-caption, .field-label, .form-label");
			if (labelEl) {
				const labelText = normalizeText(labelEl.innerText || labelEl.textContent);
				if (labelText) return labelText;
			}
		}
		const inputRow = el.closest(".field-input-row") || el.closest(".field-wrapper");
		if (inputRow) {
			const caption = inputRow.querySelector(".field-caption");
			if (caption) {
				const captionText = normalizeText(caption.innerText || caption.textContent);
				if (captionText) return captionText;
			}
		}
		const prev = el.closest(".field-content")?.previousElementSibling;
		if (prev && prev.classList?.contains("field-caption")) {
			const prevText = normalizeText(prev.innerText || prev.textContent);
			if (prevText) return prevText;
		}
	}
	const clone = el.cloneNode(true);
	clone.querySelectorAll(".material-symbols-outlined, .material-icons, svg").forEach((node) => node.remove());
	const text = normalizeText(clone.innerText || clone.textContent);
	if (text) return text;
	const placeholder = normalizeText(el.getAttribute("placeholder"));
	if (placeholder) return placeholder;
	const title = normalizeText(el.getAttribute("title"));
	if (title) return title;
	return "";
};

const shouldIgnoreLabel = (label) => {
	if (!label) return true;
	if (label.length < MIN_LABEL_LENGTH) return true;
	return false;
};

const formatForClipboard = (payload) => {
	const label = payload?.label || "";
	const value = payload?.value || "";
	if (payload?.type === "click" && label) return `Click "${label}"`;
	if (payload?.type === "input" && (label || value)) {
		return `Enter "${value || "[value]"}" into "${label || "[field]"}"`;
	}
	if (payload?.type === "select" && (label || value)) {
		return `Select "${value || "[option]"}" from "${label || "[dropdown]"}"`;
	}
	if (payload?.type === "toggle" && label) {
		return payload.checked ? `Enable "${label}"` : `Disable "${label}"`;
	}
	return null;
};

const sendEvent = (payload) => {
	console.log("[Recorder] captured", payload);
	updateDebugBadge(`Captured: ${payload.type}`);
	try {
		if (chrome?.runtime?.id) {
			chrome.runtime.sendMessage({ type: "event", payload }, () => {
				if (chrome.runtime.lastError && DEBUG_VERBOSE) {
					console.warn("[Recorder] sendMessage error", chrome.runtime.lastError.message);
				}
			});
		}
	} catch (error) {
		if (DEBUG_VERBOSE) console.warn("[Recorder] sendMessage exception", error);
	}

	if (!DEBUG_COPY_TO_CLIPBOARD) return;
	const text = formatForClipboard(payload);
	if (!text) return;
	if (!navigator.clipboard?.writeText) return;
	navigator.clipboard.writeText(text).then(
		() => {
			console.log("[Recorder] Clipboard", text);
		},
		() => {
			// Ignore clipboard failures (no permission or user gesture).
		}
	);
};

const isMeaningfulClickTarget = (el) => {
	if (!el) return false;
	const tag = el.tagName?.toLowerCase();
	if (tag === "button" || tag === "a") return true;
	if (tag === "input") {
		const type = (el.getAttribute("type") || "").toLowerCase();
		if (type === "submit" || type === "button" || type === "reset") return true;
		return type === "" || type === "text" || type === "email" || type === "number"
			|| type === "search" || type === "tel" || type === "url";
	}
	const role = (el.getAttribute("role") || "").toLowerCase();
	if (role === "button") return true;
	if (el.onclick) return true;
	if (el.classList?.contains("cursor-pointer")) return true;
	return false;
};

const getClickTarget = (el) => {
	if (!el) return null;
	if (isMeaningfulClickTarget(el)) return el;
	return el.closest("button, a, [role='button'], input[type='submit'], input[type='button'], input[type='reset'], .cursor-pointer, [onclick]");
};

const debounceEvent = (key) => {
	const now = Date.now();
	const last = lastEventCache.get(key);
	if (last && now - last < CLICK_DEBOUNCE_MS) {
		return true;
	}
	lastEventCache.set(key, now);
	return false;
};

document.addEventListener(
	"click",
	(event) => {
		const target = getClickTarget(event.target);
		if (!target) return;
		const label = getElementLabel(target);
		if (shouldIgnoreLabel(label)) return;
		const key = `click:${label}`;
		if (debounceEvent(key)) return;
		sendEvent({
			type: "click",
			label,
			timestamp: Date.now(),
		});
	},
	true
);

document.addEventListener(
	"focusin",
	(event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
		const type = (target.getAttribute("type") || "").toLowerCase();
		if (type === "checkbox" || type === "radio") return;
		focusValueCache.set(target, target.value);
	},
	true
);

document.addEventListener(
	"focusout",
	(event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
		const type = (target.getAttribute("type") || "").toLowerCase();
		if (type === "checkbox" || type === "radio") return;
		focusValueCache.delete(target);
	},
	true
);

document.addEventListener(
	"input",
	(event) => {
		const target = event.target;
		if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
		const type = (target.getAttribute("type") || "").toLowerCase();
		if (type === "checkbox" || type === "radio" || type === "password") return;
		const key = target;
		if (inputDebounceTimers.has(key)) {
			clearTimeout(inputDebounceTimers.get(key));
		}
		inputDebounceTimers.set(
			key,
			setTimeout(() => {
				inputDebounceTimers.delete(key);
				const label = getElementLabel(target);
				if (shouldIgnoreLabel(label)) return;
				const value = normalizeText(target.value || "");
				if (!value) return;
				const lastValue = lastInputValueCache.get(target);
				if (lastValue === value) return;
				lastInputValueCache.set(target, value);
				sendEvent({
					type: "input",
					label,
					value,
					timestamp: Date.now(),
				});
			}, INPUT_DEBOUNCE_MS)
		);
	},
	true
);

document.addEventListener(
	"change",
	(event) => {
		const target = event.target;
		if (target instanceof HTMLSelectElement) {
			const label = getElementLabel(target);
			if (shouldIgnoreLabel(label)) return;
			const selectedOption = target.selectedOptions?.[0];
			const value = normalizeText(selectedOption?.textContent || target.value);
			if (!value) return;
			sendEvent({
				type: "select",
				label,
				value,
				timestamp: Date.now(),
			});
			return;
		}

		if (target instanceof HTMLInputElement) {
			const type = (target.getAttribute("type") || "").toLowerCase();
			if (type !== "checkbox" && type !== "radio") return;
			const label = getElementLabel(target);
			if (shouldIgnoreLabel(label)) return;
			sendEvent({
				type: "toggle",
				label,
				checked: target.checked,
				timestamp: Date.now(),
			});
		}
	},
	true
);
