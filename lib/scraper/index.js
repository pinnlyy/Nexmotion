/**
 * Nexmotion scraper — public API surface.
 * Re-exports the modular pieces so route handlers and client code
 * can import from a single entrypoint.
 */

export { apiRequest, ApiError, parseJsonSafe, paginate, buildUrl, RequestOptions } from './api';
export { detectInputKind, normalizeQuery, InputKind, DetectedInput } from './finder';
export { finder, search, SearchResult, SearchOptions, SearchResponse, getRegistry } from './search';
export { detail, parseProjectMeta, driveDirectUrl, isSupportedPresetUrl, PresetDetail } from './detail';
export { getSlots, MediaSlot, SlotKind, slotStorageKey } from './slots';
export { renderPresetVideo } from './renderer';
export { validateMediaFile, safeFilename, MAX_FILE_BYTES, ALLOWED_MIME } from '../media/store';
export { validateXmlBasic, sanitizeFilename, buildZip } from '../export/engine';
