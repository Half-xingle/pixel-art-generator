/**
 * Set up drag-and-drop and click-to-upload for image files.
 * @param {HTMLElement} area - Upload drop zone element
 * @param {HTMLInputElement} input - Hidden file input
 * @param {(data: ImageData, img: HTMLImageElement) => void} onLoad - Callback with image data
 */
export function setupUpload(area, input, onLoad) {
  area.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]);
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.style.borderColor = '#e94560';
  });
  area.addEventListener('dragleave', () => {
    area.style.borderColor = '#0f3460';
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = '#0f3460';
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  function loadFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片太大（超过 10MB），请压缩后重试');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Draw image to a hidden canvas to get ImageData
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        onLoad(imageData, img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
