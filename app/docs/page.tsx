export default function DocsPage() {
  return (
    <div>
      <h1 className="page-title">API Documentation</h1>
      <p className="page-sub">All endpoints that exist in this deployment. Nothing here is invented.</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>GET /api/search</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 10 }}>Keyword search across the configured preset registry.</p>
        <pre className="code">
<b className="key">GET</b> /api/search?q=<span className="str">"phonk"</span>&mode=<span className="str">fast|deep</span>&page=<span className="str">1</span>&limit=<span className="str">20</span>
{'\n'}<span className="cli-mut">{'> {}'} 200</span>
{`{
  "ok": true, "mode": "fast", "detectedKind": "keyword",
  "page": 1,
  "results": [
    { "id": "...", "title": "...", "platform": "...", "creator": "...",
      "url": "...", "thumbnail": null, "presetLinks": ["..."] }
  ],
  "total": 0, "source": "none"
}`}
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>GET /api/find</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 10 }}>Detects input type (URL/keyword) and routes to the appropriate handler.</p>
        <pre className="code">
<b className="key">GET</b> /api/find?input=<span className="str">"https://..."</span>&mode=<span className="str">fast|deep</span>
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>GET /api/detail</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 10 }}>Fetches and parses a preset XML. Add <code>?xml=1</code> to include the raw XML string.</p>
        <pre className="code">
<b className="key">GET</b> /api/detail?target=<span className="str">"&lt;url or xml&gt;"</span>&xml=<span className="str">1</span>
{`{
  "ok": true, "title": "Project name", "resolution": "1280×720",
  "fps": 30, "durationSec": 10, "layerCount": 14,
  "layers": [{ "name": "...", "type": "...", "ref": "...", "props": [...] }],
  "slots": [{ "id": "...", "kind": "image", "src": "...", "slotName": "..." }]
}`}
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>GET /api/slots</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 10 }}>Returns only the media slots detected in a preset.</p>
        <pre className="code"><b className="key">GET</b> /api/slots?target=<span className="str">"&lt;url&gt;"</span></pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>POST /api/media/upload</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13.5, marginBottom: 10 }}>Multipart upload. Max 50 MB. Rate-limited per IP (20/min).</p>
        <pre className="code">
<b className="key">POST</b> /api/media/upload
Content-Type: <span className="str">multipart/form-data</span>
{'\n'}Body: <span className="str">file=&lt;binary&gt;</span>
{`{ "ok": true, "item": { "id": "m_...", "kind": "image", "name": "a.png", "size": 10240, "dataUrl": "data:image/png;base64,..." } }`}
Bad: <span className="str">{'{ "ok": false, "error": "Unsupported MIME type" }'}</span>
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>POST /api/media/replace</h3>
        <pre className="code">
<b className="key">POST</b> /api/media/replace
{`Body: {
  "xml": "<project ...>",
  "replacements": [{ "slotId": "image-https://...#0", "mediaId": "m_..." }]
}
→ { "ok": true, "xml": "<project ... modified ...>", "applied": 1 }
`}
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>POST /api/export/preset</h3>
        <pre className="code">
<b className="key">POST</b> /api/export/preset
{`Body: {
  "xml": "<project ...>",
  "filename": "my-preset",
  "includeMedia": true,
  "replacements": [...]
}
→ binary XML (application/octet-stream) or ZIP (application/zip) attachment`}
        </pre>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3>POST /api/export/video</h3>
        <pre className="code">
<b className="key">POST</b> /api/export/video
{`Body: { "presetTarget": "<url or xml>", "width": 1920, "height": 1080,
        "fps": 30, "quality": "medium", "format": "mp4", "includeAudio": true }
→ { "ok": true, "spec": {...}, "nextStep": "client-render" }`}
        </pre>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          The server returns a render spec and delegates actual encoding to the browser (WebCodecs / MediaRecorder) or to a provisioned headless Chromium + FFmpeg worker.
        </p>
      </div>

      <div className="card">
        <h3>GET /api/export/status</h3>
        <pre className="code"><b className="key">GET</b> /api/export/status?id=<span className="str">"&lt;jobId&gt;"</span>
{`→ { "ok": true, "id": "...", "status": "done", "stage": "encoding",
    "progress": 0.87, "bytes": 2048000, "fileUrl": "..." }`}
        </pre>
      </div>
    </div>
  );
}
