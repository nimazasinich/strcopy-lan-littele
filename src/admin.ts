// Admin Client Logic
const usbGrid = document.getElementById('usb-grid')!;
const queueTableBody = document.getElementById('queue-table-body')!;
const emptyQueue = document.getElementById('empty-queue')!;
const totalCopiedEl = document.getElementById('total-copied')!;
const refreshUsbsBtn = document.getElementById('refresh-usbs')!;

async function fetchUSBs() {
  try {
    const res = await fetch('/api/usbs');
    const usbs = await res.json();
    renderUSBs(usbs);
  } catch (err) {
    console.error('Failed to fetch USBs', err);
  }
}

function renderUSBs(usbs: any[]) {
  usbGrid.innerHTML = '';
  usbs.forEach(usb => {
    const card = document.createElement('div');
    card.className = 'bg-netflix-dark p-6 rounded-xl border border-gray-800 flex flex-col items-center gap-4';
    
    const freeGB = (usb.freeSpace / (1024**3)).toFixed(1);
    const totalGB = (usb.totalSpace / (1024**3)).toFixed(1);
    const usedPercent = Math.round(((usb.totalSpace - usb.freeSpace) / usb.totalSpace) * 100);

    card.innerHTML = `
      <div class="w-full flex justify-between items-start mb-2">
        <span class="bg-green-500 bg-opacity-20 text-green-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Online</span>
        <span class="text-gray-500 text-xs">${usb.driveLetter}</span>
      </div>
      <img src="${usb.qrCodeUrl}" alt="QR Code" class="w-40 h-40 bg-white p-2 rounded-lg">
      <div class="text-center">
        <h3 class="font-bold text-lg">${usb.volumeName || 'USB Drive'}</h3>
        <p class="text-xs text-gray-500 mb-4">Token: ${usb.sessionToken.substring(0, 8)}...</p>
      </div>
      <div class="w-full">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-400">${freeGB} GB Free</span>
          <span class="text-gray-400">${usedPercent}% Used</span>
        </div>
        <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div class="h-full bg-netflix-red" style="width: ${usedPercent}%"></div>
        </div>
      </div>
    `;
    usbGrid.appendChild(card);
  });
}

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}?admin=true`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'INIT_USBS') {
      renderUSBs(data.usbs);
    } else if (data.type === 'JOB_UPDATE') {
      // In a real app, we'd manage a local state of jobs
      // For simplicity, we'll just re-fetch or update the list
      updateQueue(data.job);
    } else if (data.type === 'HEALTH_UPDATE') {
      updateHealth(data.health);
    }
  };
}

function updateHealth(health: any) {
  const cpuEl = document.getElementById('health-cpu')!;
  const ramEl = document.getElementById('health-ram')!;
  cpuEl.innerText = `${health.cpu}%`;
  ramEl.innerText = `${health.ram}%`;
}

let activeJobs: Map<string, any> = new Map();

function updateQueue(job: any) {
  activeJobs.set(job.id, job);
  renderQueue();
}

function renderQueue() {
  const jobs = Array.from(activeJobs.values()).filter(j => j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'failed');
  
  if (jobs.length === 0) {
    queueTableBody.innerHTML = '';
    emptyQueue.classList.remove('hidden');
    return;
  }

  emptyQueue.classList.add('hidden');
  queueTableBody.innerHTML = '';
  
  jobs.forEach(job => {
    const row = document.createElement('tr');
    row.className = 'border-t border-gray-800 hover:bg-white hover:bg-opacity-5 transition-colors';
    
    const percent = Math.round((job.copied / job.size) * 100);
    
    row.innerHTML = `
      <td class="px-6 py-4 font-bold">${pathBasename(job.sourceFilePath)}</td>
      <td class="px-6 py-4 text-gray-400">${job.destinationDrive}</td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full bg-netflix-red" style="width: ${percent}%"></div>
          </div>
          <span class="text-xs">${percent}%</span>
        </div>
      </td>
      <td class="px-6 py-4">
        <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusClass(job.status)}">
          ${job.status}
        </span>
      </td>
      <td class="px-6 py-4">
        <button class="text-gray-500 hover:text-white transition-colors" onclick="cancelJob('${job.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    `;
    queueTableBody.appendChild(row);
  });
}

function getStatusClass(status: string) {
  switch (status) {
    case 'copying': return 'bg-blue-500 bg-opacity-20 text-blue-500';
    case 'pending': return 'bg-yellow-500 bg-opacity-20 text-yellow-500';
    case 'completed': return 'bg-green-500 bg-opacity-20 text-green-500';
    case 'failed': return 'bg-red-500 bg-opacity-20 text-red-500';
    default: return 'bg-gray-500 bg-opacity-20 text-gray-500';
  }
}

function pathBasename(path: string) {
  return path.split(/[\\/]/).pop();
}

refreshUsbsBtn.onclick = fetchUSBs;

// Initial load
fetchUSBs();
setupWebSocket();

(window as any).cancelJob = async (jobId: string) => {
  try {
    const res = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const data = await res.json();
    if (data.success) {
      activeJobs.delete(jobId);
      renderQueue();
    }
  } catch (err) {
    console.error('Failed to cancel job', err);
  }
};
