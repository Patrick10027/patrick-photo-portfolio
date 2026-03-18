let images = [];
let filteredImages = [];
let currentIndex = 0;

const minHeight = 260;
let targetHeight = 400;
const maxHeight = 850;

let layoutTimer = null;
let manifestLoaded = false;

async function loadManifest() {
  try {
    const response = await fetch('./data/gallery-manifest.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }

    images = await response.json();
    filteredImages = [...images];

    populateFilters();
    await renderImages();
    manifestLoaded = true;
  } catch (error) {
    console.error('Error loading gallery manifest:', error);
  }
}

function populateFilters() {
  const select = document.getElementById('categoryFilter');
  if (!select) return;

  // Reset to avoid duplicates if manifest is ever reloaded
  select.innerHTML = '<option value="">All categories</option>';

  const categories = [...new Set(
    images
      .flatMap((img) => (img.categories && img.categories.length ? img.categories : [img.category]))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function imageMatchesQuery(img, q) {
  if (!q) return true;

  const haystack = [
    img.searchable_text || '',
    img.token || '',
    img.caption || '',
    img.category || '',
    ...((img.categories) || []),
    ...((img.tags) || []),
    ...((img.search_phrases) || []),
    ...((img.searchable_terms) || []),
    img.camera || ''
  ]
    .join(' ')
    .toLowerCase();

  const words = q.split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

function imageMatchesCategory(img, cat) {
  if (!cat) return true;
  const categories = new Set([img.category, ...((img.categories) || [])].filter(Boolean));
  return categories.has(cat);
}

function applyFilters() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');

  const q = (searchInput?.value || '').trim().toLowerCase();
  const cat = categoryFilter?.value || '';

  filteredImages = images.filter(
    (img) => imageMatchesQuery(img, q) && imageMatchesCategory(img, cat)
  );

  renderImages();
}

async function renderImages() {
  const container = document.getElementById('imageContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!filteredImages.length) {
    const empty = document.createElement('div');
    empty.className = 'gallery-empty-state';
    empty.textContent = 'No images match your search.';
    container.appendChild(empty);
    return;
  }

  const loadPromises = filteredImages.map((image, index) => {
    return new Promise((resolve) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image';
      wrapper.dataset.index = String(index);

      const img = document.createElement('img');
      img.src = image.thumb || image.preview || image.src || '';
      img.alt = image.caption || image.token || `Image ${index + 1}`;
      img.dataset.index = String(index);
      img.loading = 'eager';
      img.decoding = 'async';
      img.title = [
        image.caption,
        ...(image.categories || []),
        ...((image.tags || []).slice(0, 6))
      ].filter(Boolean).join(' • ');

      img.addEventListener('click', () => openModal(index));

      img.onload = async () => {
        try {
          if (img.decode) {
            await img.decode().catch(() => {});
          }
        } finally {
          resolve();
        }
      };

      img.onerror = () => {
        console.warn('Failed to load image:', img.src);
        wrapper.classList.add('image-load-failed');
        resolve();
      };

      wrapper.appendChild(img);
      container.appendChild(wrapper);
    });
  });

  await Promise.all(loadPromises);

  requestAnimationFrame(() => {
    adjustImages();
  });
}

function scheduleAdjustImages() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      adjustImages();
    });
  }, 60);
}

function adjustImages() {
  const container = document.getElementById('imageContainer');
  if (!container) return;
  if (!filteredImages.length) return;

  const containerWidth = container.clientWidth;
  if (!containerWidth || containerWidth <= 0) return;

  const wrappers = Array.from(container.querySelectorAll('.image'));

  // Clear old sizing before recalculating
  wrappers.forEach((wrapper) => {
    wrapper.style.width = '';
    wrapper.style.height = '';
    wrapper.style.flex = '0 0 auto';
  });

  let row = [];
  let accumulatedWidth = 0;

  filteredImages.forEach((image, index) => {
    const imgWidth = Number(image.width) || 1;
    const imgHeight = Number(image.height) || 1;
    const aspectRatio = imgWidth / imgHeight;
    const projectedWidth = aspectRatio * targetHeight;

    if (row.length > 0 && accumulatedWidth + projectedWidth > containerWidth) {
      scaleRow(row, accumulatedWidth, containerWidth);
      row = [];
      accumulatedWidth = 0;
    }

    row.push({
      index,
      width: projectedWidth,
      height: targetHeight
    });

    accumulatedWidth += projectedWidth;
  });

  // Last row: don't force-stretch excessively; keep it natural
  if (row.length > 0) {
    const lastRowTargetWidth = Math.min(containerWidth, accumulatedWidth);
    scaleRow(row, accumulatedWidth, lastRowTargetWidth);
  }
}

function scaleRow(row, totalWidth, targetRowWidth) {
  if (!row.length || totalWidth <= 0) return;

  const scaleFactor = targetRowWidth / totalWidth;
  const wrappers = document.querySelectorAll('#imageContainer .image');

  row.forEach((item) => {
    const wrapper = wrappers[item.index];
    if (!wrapper) return;

    wrapper.style.width = `${item.width * scaleFactor}px`;
    wrapper.style.height = `${item.height * scaleFactor}px`;
    wrapper.style.flex = '0 0 auto';
  });
}

function openModal(index) {
  if (!filteredImages.length) return;

  currentIndex = index;
  const item = filteredImages[index];
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('img01');
  const caption = document.querySelector('.caption');

  if (!modal || !modalImg || !caption) return;

  modalImg.src = item.preview || item.thumb || item.src || '';
  modalImg.alt = item.caption || item.token || 'Preview image';

  const captionParts = [
    item.caption || item.token || '',
    ...(item.categories || []),
    ...((item.tags || []).slice(0, 8))
  ].filter(Boolean);

  caption.textContent = captionParts.join(' • ');

  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
}

function closeModal() {
  const modal = document.getElementById('imageModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function plusSlides(step) {
  if (!filteredImages.length) return;
  currentIndex = (currentIndex + step + filteredImages.length) % filteredImages.length;
  openModal(currentIndex);
}

document.addEventListener('DOMContentLoaded', () => {
  loadManifest();

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const plusBtn = document.getElementById('plusBtn');
  const minusBtn = document.getElementById('minusBtn');
  const prevBtn = document.querySelector('.prev');
  const nextBtn = document.querySelector('.next');
  const closeBtn = document.querySelector('.close');
  const modal = document.getElementById('imageModal');

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('input', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      if (targetHeight < maxHeight) {
        targetHeight += 50;
        scheduleAdjustImages();
      }
    });
  }

  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      if (targetHeight > minHeight) {
        targetHeight -= 50;
        scheduleAdjustImages();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      plusSlides(-1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      plusSlides(1);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  window.addEventListener('resize', scheduleAdjustImages);

  document.addEventListener('keydown', (event) => {
    const modalOpen = document.getElementById('imageModal')?.style.display === 'flex';
    if (!modalOpen) return;

    if (event.key === 'Escape') closeModal();
    if (event.key === 'ArrowLeft') plusSlides(-1);
    if (event.key === 'ArrowRight') plusSlides(1);
  });

  // Extra stabilization after full page load
  window.addEventListener('load', () => {
    if (manifestLoaded) {
      scheduleAdjustImages();
    }
  });
});