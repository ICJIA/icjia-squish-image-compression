const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results');
const themeToggle = document.getElementById('theme-toggle');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');
const progress = document.getElementById('progress');
const progressCounter = progress.querySelector('.progress-counter');

// Theme initialization
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.checked = savedTheme === 'light';
    document.body.classList.toggle('bg-gray-900', savedTheme === 'dark');
    document.body.classList.toggle('bg-gray-100', savedTheme === 'light');
}

// Theme switching
themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('bg-gray-900', theme === 'dark');
    document.body.classList.toggle('bg-gray-100', theme === 'light');
    localStorage.setItem('theme', theme);
});

// Call initialize theme when the page loads
initializeTheme();

// Initialize compression value display
compressionValue.textContent = `${compressionSlider.value}%`;

// Drag and drop handlers
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropZone.classList.add('border-blue-500');
}

function unhighlight() {
    dropZone.classList.remove('border-blue-500');
}

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileSelect, false);
compressionSlider.addEventListener('input', () => {
    compressionValue.textContent = `${compressionSlider.value}%`;
});
resetBtn.addEventListener('click', resetAll);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Add progress control functions
function showProgress() {
    progress.classList.remove('hidden');
}

function updateProgress(current, total) {
    progressCounter.textContent = `${current} of ${total}`;
}

function hideProgress() {
    progress.classList.add('hidden');
}

// Update handleFiles to show completion toast
async function handleFiles(files) {
    const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
        try {
            showProgress();
            for (let i = 0; i < imageFiles.length; i++) {
                updateProgress(i + 1, imageFiles.length);
                await compressImage(imageFiles[i]);
            }
            hideProgress();
            showToast(`Successfully compressed ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`);
        } catch (error) {
            hideProgress();
            showToast('Error compressing images');
        }
    }
}

async function compressImage(file) {
    // Reverse the compression level logic (100 - slider value)
    // This way, higher slider value = higher quality (less compression)
    const compressionLevel = (100 - parseInt(compressionSlider.value)) / 100;
    const options = {
        maxSizeMB: Math.max(0.1, file.size / (1024 * 1024) * compressionLevel), // Lower bound of 0.1MB
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 1 - compressionLevel // Reverse for quality (0 = worst, 1 = best)
    };

    try {
        const compressedFile = await imageCompression(file, options);
        const compressionRatio = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
        
        const card = createResultCard({
            originalName: file.name,
            originalSize: (file.size / 1024).toFixed(1),
            compressedSize: (compressedFile.size / 1024).toFixed(1),
            compressionRatio: compressionRatio,
            blob: compressedFile
        });
        
        resultsContainer.insertBefore(card, resultsContainer.firstChild);
    } catch (error) {
        console.error('Error compressing image:', error);
        hideProgress();
        throw error; // Re-throw to be caught by handleFiles
    }
}

function createResultCard(data) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    // Add function to truncate filename
    const truncateFilename = (filename, maxLength = 20) => {
        if (filename.length <= maxLength) return filename;
        const extension = filename.split('.').pop();
        const name = filename.substring(0, filename.length - extension.length - 1);
        const truncatedName = name.substring(0, maxLength - 3) + '...';
        return `${truncatedName}.${extension}`;
    };
    
    const reader = new FileReader();
    reader.readAsDataURL(data.blob);
    
    reader.onloadend = () => {
        card.innerHTML = `
            <div class="space-y-4">
                <img src="${reader.result}" alt="Compressed preview" class="w-full h-48 object-cover rounded">
                <div class="space-y-2">
                    <p class="font-semibold truncate" title="${data.originalName}">${truncateFilename(data.originalName)}</p>
                    <p class="text-sm">Original: ${data.originalSize}KB</p>
                    <p class="text-sm">Compressed: ${data.compressedSize}KB</p>
                    <p class="text-sm text-green-500">Saved: ${data.compressionRatio}%</p>
                    <button class="download-button w-full" onclick="downloadImage(this, '${reader.result}', '${data.originalName}')">
                        Download
                    </button>
                </div>
            </div>
        `;
    };
    
    return card;
}

function downloadImage(button, dataUrl, fileName) {
    button.disabled = true;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `compressed_${fileName}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    button.disabled = false;
}

// Update resetAll to use new showToast
function resetAll() {
    resultsContainer.innerHTML = '';
    compressionSlider.value = 50;
    compressionValue.textContent = '50%';
    fileInput.value = '';
    showToast('Reset successful');
}

// Update showToast to accept a message parameter
function showToast(message) {
    toast.querySelector('.toast-content').textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
