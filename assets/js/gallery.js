let images = [];
let filteredImages = [];
let currentIndex = 0;
const minHeight = 260;
let targetHeight = 400;
const maxHeight = 850;

async function loadManifest() {
  const response = await fetch('./data/gallery-manifest.json');
  images = await response.json();
  filteredImages = [...images];
  populateFilters();
  renderImages();
}

function populateFilters() {
  const select = document.getElementById('categoryFilter');
  const categories = [...new Set(images.flatMap((i) => (i.categories && i.categories.length ? i.categories : [i.category])).filter(Boolean))].sort();
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

function imageMatchesQuery(img, q) {
  if (!q) return true;
  const hay = [
    img.searchable_text || '',
    img.token || '',
    img.caption || '',
    img.category || '',
    ...((img.categories) || []),
    ...((img.tags) || []),
    ...((img.search_phrases) || []),
    ...((img.searchable_terms) || []),
    img.camera || ''
  ].join(' ').toLowerCase();

  const words = q.split(/\s+/).filter(Boolean);
  return words.every((word) => hay.includes(word));
}

function imageMatchesCategory(img, cat) {
  if (!cat) return true;
  const categories = new Set([img.category, ...((img.categories) || [])].filter(Boolean));
  return categories.has(cat);
}

function applyFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const cat = document.getElementById('categoryFilter').value;
  filteredImages = images.filter((img) => imageMatchesQuery(img, q) && imageMatchesCategory(img, cat));
  renderImages();
}

function renderImages() {
  const container = document.getElementById('imageContainer');
  container.innerHTML = '';
  filteredImages.forEach((image, index) => {
    const div = document.createElement('div');
    div.className = 'image';
    const img = document.createElement('img');
    img.src = image.thumb || image.preview;
    img.alt = image.caption || image.token;
    img.dataset.index = String(index);
    img.title = [image.caption, ...(image.categories || []), ...((image.tags || []).slice(0, 6))].filter(Boolean).join(' • ');
    img.addEventListener('click', () => openModal(index));
    div.appendChild(img);
    container.appendChild(div);
  });
  requestAnimationFrame(adjustImages);
}

function adjustImages() {
  const container = document.getElementById('imageContainer');
  const containerWidth = container.clientWidth;
  let row = [];
  let accumulatedWidth = 0;
  filteredImages.forEach((image) => {
    const aspectRatio = (image.width || 1) / (image.height || 1);
    const width = aspectRatio * targetHeight;
    accumulatedWidth += width;
    if (accumulatedWidth > containerWidth && row.length > 0) {
      scaleRow(row, accumulatedWidth - width, containerWidth);
      row = [];
      accumulatedWidth = width;
    }
    row.push({ image, width, height: targetHeight });
  });
  if (row.length) scaleRow(row, accumulatedWidth, containerWidth);
}

function scaleRow(row, totalWidth, containerWidth) {
  const scaleFactor = containerWidth / Math.max(totalWidth, 1);
  row.forEach((item) => {
    const imageIndex = filteredImages.indexOf(item.image);
    const imgEl = document.querySelector(`img[data-index="${imageIndex}"]`);
    if (!imgEl) return;
    const wrapper = imgEl.parentNode;
    wrapper.style.width = `${item.width * scaleFactor}px`;
    wrapper.style.height = `${item.height * scaleFactor}px`;
  });
}

function openModal(index) {
  currentIndex = index;
  const item = filteredImages[index];
  const modal = document.getElementById('imageModal');
  document.getElementById('img01').src = item.preview || item.thumb;
  const captionParts = [item.caption || item.token || '', ...(item.categories || []), ...((item.tags || []).slice(0, 8))].filter(Boolean);
  document.querySelector('.caption').textContent = captionParts.join(' • ');
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
}

function closeModal() {
  document.getElementById('imageModal').style.display = 'none';
}

function plusSlides(step) {
  if (!filteredImages.length) return;
  currentIndex = (currentIndex + step + filteredImages.length) % filteredImages.length;
  openModal(currentIndex);
}

document.addEventListener('DOMContentLoaded', () => {
  loadManifest();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('categoryFilter').addEventListener('input', applyFilters);
  document.getElementById('plusBtn').addEventListener('click', () => {
    if (targetHeight <= maxHeight) {
      targetHeight += 50;
      adjustImages();
    }
  });
  document.getElementById('minusBtn').addEventListener('click', () => {
    if (targetHeight >= minHeight) {
      targetHeight -= 50;
      adjustImages();
    }
  });
  document.querySelector('.prev').addEventListener('click', (event) => {
    event.stopPropagation();
    plusSlides(-1);
  });
  document.querySelector('.next').addEventListener('click', (event) => {
    event.stopPropagation();
    plusSlides(1);
  });
  document.querySelector('.close').addEventListener('click', closeModal);
  document.getElementById('imageModal').addEventListener('click', (event) => {
    if (event.target.id === 'imageModal') closeModal();
  });
  window.addEventListener('resize', adjustImages);
});
