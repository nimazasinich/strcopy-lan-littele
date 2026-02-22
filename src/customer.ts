// Customer Client Logic - Filimo Inspired
const urlParams = new URLSearchParams(window.location.search);
let sessionToken = urlParams.get('token') || getCookie('sessionToken');
const isPreview = urlParams.get('preview') === 'true';

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

const landingState = document.getElementById('landing-state')!;
const connectedState = document.getElementById('connected-state')!;
const movieGrid = document.getElementById('movie-grid')!;
const usbName = document.getElementById('usb-name')!;
const usbSpace = document.getElementById('usb-space')!;
const usbInfo = document.getElementById('usb-info')!;
const progressOverlay = document.getElementById('progress-overlay')!;
const progressBar = document.getElementById('progress-bar')!;
const progressPercent = document.getElementById('progress-percent')!;
const progressTitle = document.getElementById('progress-title')!;
const progressPoster = document.getElementById('progress-poster')!;

const movieModal = document.getElementById('movie-modal')!;
const closeModal = document.getElementById('close-modal')!;
const modalTitle = document.getElementById('modal-title')!;
const modalYear = document.getElementById('modal-year')!;
const modalGenre = document.getElementById('modal-genre')!;
const modalSize = document.getElementById('modal-size')!;
const modalVideo = document.getElementById('modal-video')!;
const addToQueueBtn = document.getElementById('add-to-queue')!;
const previewModeBtn = document.getElementById('preview-mode-btn')!;

let currentMovies: any[] = [];
let selectedMovie: any = null;

// Helper for Persian numbers
function toPersianDigits(n: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n.toString().replace(/\d/g, (x) => persianDigits[parseInt(x)]);
}

function formatSize(bytes: number): string {
  const gb = (bytes / (1024 ** 3)).toFixed(1);
  return `${toPersianDigits(gb)} گیگابایت`;
}

// Initialize
if (sessionToken || isPreview) {
  initApp();
}

async function initApp() {
  landingState.classList.add('hidden');
  connectedState.classList.remove('hidden');
  usbInfo.classList.remove('hidden');
  
  if (isPreview) {
    setupPreviewData();
  } else {
    await fetchMovies();
    setupWebSocket();
  }
}

function setupPreviewData() {
  currentMovies = [
    { id: 1, title: 'تلقین', year: 2010, genre: 'علمی تخیلی', size: 2.5 * 1024**3, posterUrl: 'https://picsum.photos/seed/inception/300/450', rating: 4.8 },
    { id: 2, title: 'ماتریکس', year: 1999, genre: 'اکشن', size: 1.8 * 1024**3, posterUrl: 'https://picsum.photos/seed/matrix/300/450', rating: 4.7 },
    { id: 3, title: 'میان‌ستاره‌ای', year: 2014, genre: 'درام', size: 3.2 * 1024**3, posterUrl: 'https://picsum.photos/seed/interstellar/300/450', rating: 4.9 },
    { id: 4, title: 'جوکر', year: 2019, genre: 'جنایی', size: 2.1 * 1024**3, posterUrl: 'https://picsum.photos/seed/joker/300/450', rating: 4.5 },
    { id: 5, title: 'شوالیه تاریکی', year: 2008, genre: 'اکشن', size: 2.8 * 1024**3, posterUrl: 'https://picsum.photos/seed/darkknight/300/450', rating: 4.9 },
    { id: 6, title: 'انگل', year: 2019, genre: 'هیجان انگیز', size: 1.9 * 1024**3, posterUrl: 'https://picsum.photos/seed/parasite/300/450', rating: 4.6 },
  ];
  renderMovies(currentMovies);
  usbName.innerText = 'فلش ۳۲ گیگابایتی (پیش‌نمایش)';
  usbSpace.innerText = toPersianDigits('۱۲.۵') + ' گیگابایت فضای خالی';
}

async function fetchMovies() {
  try {
    const res = await fetch('/api/movies');
    currentMovies = await res.json();
    renderMovies(currentMovies);
  } catch (err) {
    console.error('Failed to fetch movies', err);
  }
}

function renderMovies(movies: any[]) {
  movieGrid.innerHTML = '';
  movies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'filimo-card aspect-[2/3] group';
    card.innerHTML = `
      <img src="${movie.posterUrl}" alt="${movie.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-4">
        <h3 class="font-black text-lg mb-1">${movie.title}</h3>
        <div class="flex justify-between items-center">
          <span class="text-[10px] text-white/60">${formatSize(movie.size)}</span>
          <div class="flex items-center gap-1 text-filimo-orange">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span class="text-xs font-black">${toPersianDigits(movie.rating || '4.5')}</span>
          </div>
        </div>
      </div>
    `;
    card.onclick = () => openMovieModal(movie);
    movieGrid.appendChild(card);
  });
}

function openMovieModal(movie: any) {
  selectedMovie = movie;
  modalTitle.innerText = movie.title;
  modalYear.innerText = toPersianDigits(movie.year);
  modalGenre.innerText = movie.genre;
  modalSize.innerText = formatSize(movie.size);
  modalVideo.innerHTML = `
    <img src="${movie.posterUrl}" class="w-full h-full object-cover opacity-40 blur-md">
    <div class="absolute inset-0 flex items-center justify-center">
       <div class="w-20 h-20 bg-filimo-orange rounded-full flex items-center justify-center shadow-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-black mr-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
       </div>
    </div>
  `;
  movieModal.classList.remove('hidden');
  movieModal.classList.add('flex');
}

closeModal.onclick = () => {
  movieModal.classList.add('hidden');
  movieModal.classList.remove('flex');
};

addToQueueBtn.onclick = async () => {
  if (isPreview) {
    alert('این یک پیش‌نمایش است. در محیط واقعی فیلم به صف کپی اضافه می‌شود.');
    return;
  }
  if (!selectedMovie || !sessionToken) return;
  
  try {
    const res = await fetch('/api/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: selectedMovie.id, sessionToken })
    });
    
    if (res.ok) {
      movieModal.classList.add('hidden');
      movieModal.classList.remove('flex');
    } else {
      const err = await res.json();
      alert(err.error);
    }
  } catch (err) {
    console.error('Copy request failed', err);
  }
};

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}?token=${sessionToken}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'INIT_JOBS') {
      updateProgress(data.jobs);
    } else if (data.type === 'JOB_UPDATE') {
      updateProgress([data.job]);
    }
  };
}

function updateProgress(jobs: any[]) {
  const activeJob = jobs.find(j => j.status === 'copying' || j.status === 'pending');
  
  if (activeJob) {
    progressOverlay.classList.remove('translate-y-full');
    const percent = Math.round((activeJob.copied / activeJob.size) * 100);
    progressBar.style.width = `${percent}%`;
    progressPercent.innerText = toPersianDigits(percent) + '٪';
    progressTitle.innerText = activeJob.status === 'pending' ? 'در صف انتظار...' : `در حال کپی: ${pathBasename(activeJob.destinationPath)}`;
    
    // Find movie for poster
    const movie = currentMovies.find(m => activeJob.sourceFilePath.includes(m.title) || activeJob.destinationPath.includes(m.title));
    if (movie) {
      progressPoster.innerHTML = `<img src="${movie.posterUrl}" class="w-full h-full object-cover">`;
    }
  } else {
    progressOverlay.classList.add('translate-y-full');
  }
}

function pathBasename(path: string) {
  return path.split(/[\\/]/).pop();
}

// Search functionality
const searchInput = document.getElementById('search-input') as HTMLInputElement;
searchInput.oninput = () => {
  const query = searchInput.value.toLowerCase();
  const filtered = currentMovies.filter(m => m.title.toLowerCase().includes(query) || m.genre.toLowerCase().includes(query));
  renderMovies(filtered);
};

previewModeBtn.onclick = () => {
  window.location.search = '?preview=true';
};
