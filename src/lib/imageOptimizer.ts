// ==============================================================================
// Image Compression and Optimization Utility
// Optimizes branding logos and background images for fast loading and crisp UI
// ==============================================================================

export interface ImageOptimizationResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  dataUrl?: string;
}

/**
 * Optimizes a background image up to 2560x1440 down to a responsive, crisp
 * web resolution (max 2048x1152) and compresses to high-quality JPEG (0.85).
 */
export async function optimizeBackgroundImage(file: File): Promise<ImageOptimizationResult> {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Background image exceeds the 5MB limit. Please choose an image under 5MB.');
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Please upload a JPG, PNG, or WebP image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image. File may be corrupt.'));
      img.onload = () => {
        const MAX_WIDTH = 2048;
        const MAX_HEIGHT = 1152;
        let targetWidth = img.naturalWidth;
        let targetHeight = img.naturalHeight;

        // Downscale while strictly maintaining aspect ratio
        if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / targetWidth, MAX_HEIGHT / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize canvas context for optimization.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed.'));
              return;
            }
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              blob,
              width: targetWidth,
              height: targetHeight,
              originalSize: file.size,
              optimizedSize: blob.size,
              dataUrl,
            });
          },
          'image/jpeg',
          0.85
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes a company logo image (accepts PNG, SVG, JPG, WebP up to 2MB).
 * Preserves alpha transparency for PNGs and vectors for SVGs.
 */
export async function optimizeLogoImage(file: File): Promise<ImageOptimizationResult> {
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Logo file exceeds the 2MB limit. Please upload a logo under 2MB.');
  }

  // If SVG, keep raw vector format for infinite crispness
  if (file.type === 'image/svg+xml') {
    return {
      blob: file,
      width: 0,
      height: 0,
      originalSize: file.size,
      optimizedSize: file.size,
      dataUrl: URL.createObjectURL(file),
    };
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported logo format. Please upload PNG, SVG, JPG, or WebP.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read logo file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode logo image.'));
      img.onload = () => {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 400;
        let targetWidth = img.naturalWidth;
        let targetHeight = img.naturalHeight;

        if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / targetWidth, MAX_HEIGHT / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize canvas context for logo optimization.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Keep PNG format to preserve alpha channel transparency
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Logo compression failed.'));
              return;
            }
            const dataUrl = canvas.toDataURL('image/png');
            resolve({
              blob,
              width: targetWidth,
              height: targetHeight,
              originalSize: file.size,
              optimizedSize: blob.size,
              dataUrl,
            });
          },
          'image/png'
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
