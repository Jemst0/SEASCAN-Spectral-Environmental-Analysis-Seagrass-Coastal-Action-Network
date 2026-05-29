const zipInput = document.getElementById('zipInput');
const folderInput = document.getElementById('folderInput');
const submitBtn = document.getElementById('submitBtn');
const status = document.getElementById('status');
const outImg = document.getElementById('outImg');
const metricsPre = document.getElementById('metrics');

const ENDPOINT = 'http://localhost:8000/predict';

submitBtn.addEventListener('click', async () => {
  status.textContent = 'Preparing upload...';
  outImg.style.display = 'none';
  metricsPre.style.display = 'none';

  const form = new FormData();

  if (zipInput.files && zipInput.files.length > 0) {
    form.append('file', zipInput.files[0]);
  } else if (folderInput.files && folderInput.files.length > 0) {
    // append all selected files
    for (let f of folderInput.files) {
      form.append('files', f, f.name);
    }
  } else {
    status.textContent = 'Please select a ZIP or a folder of TIFF files.';
    return;
  }

  status.textContent = 'Uploading...';
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', body: form });
    if (!res.ok) {
      const txt = await res.text();
      status.textContent = 'Server error: ' + txt;
      return;
    }
    const data = await res.json();
    if (data.image_base64) {
      const dataUrl = 'data:image/png;base64,' + data.image_base64;
      // If Leaflet is available, show interactive map overlay
      if (window.L) {
        try {
          const mapDiv = document.getElementById('map');
          mapDiv.style.display = 'block';
          outImg.style.display = 'none';

          // lazy-initialize map
          if (!window._sampleLeaflet) {
            window._sampleLeaflet = {};
            window._sampleLeaflet.map = L.map('map', { crs: L.CRS.Simple, minZoom: -5, maxZoom: 8 });
          }

          const map = window._sampleLeaflet.map;
          // remove previous overlay if exists
          if (window._sampleLeaflet.overlay) {
            map.removeLayer(window._sampleLeaflet.overlay);
            window._sampleLeaflet.overlay = null;
          }

          const img = new Image();
          img.src = dataUrl;
          img.onload = () => {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const bounds = [[0, 0], [h, w]];
            window._sampleLeaflet.overlay = L.imageOverlay(dataUrl, bounds).addTo(map);
            map.setMaxBounds(bounds);
            map.setView([h / 2, w / 2], 0);
          };
        } catch (err) {
          // fallback to static image
          outImg.src = dataUrl;
          outImg.style.display = 'block';
        }
      } else {
        outImg.src = dataUrl;
        outImg.style.display = 'block';
      }
    }
    if (data.metrics) {
      metricsPre.textContent = JSON.stringify(data.metrics, null, 2);
      metricsPre.style.display = 'block';
    }
    status.textContent = 'Prediction complete.';
  } catch (err) {
    console.error(err);
    status.textContent = 'Request failed: ' + err.message;
  }
});
