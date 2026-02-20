import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.css',
})
export class QrScannerComponent implements OnInit, OnDestroy {
  /**
   * Simple title rendered above the scanner UI.
   */
  @Input() title = 'Scan QR code';

  /**
   * Optional hint text displayed under the title.
   */
  @Input() hint: string | null = null;

  /**
   * Emitted when a QR code has been successfully decoded.
   */
  @Output() scanned = new EventEmitter<string>();

  /**
   * Emitted when the underlying scanner reports an error while trying to decode.
   * Note: this may fire frequently while the camera is focusing.
   */
  @Output() scanError = new EventEmitter<string>();

  @ViewChild('videoElement', { static: false }) videoElement?: ElementRef<HTMLVideoElement>;

  private reader: any | null = null;
  private scanning = false;
  private isBrowser = typeof window !== 'undefined';
  private currentDeviceId: string | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 1;
  private videoCheckInterval: any = null;

  lastResult: string | null = null;
  hasScanSuccess = false;
  isInitializing = true;
  errorMessage: string | null = null;
  availableCameras: Array<{ deviceId: string; label: string }> = [];
  selectedCameraId: string | null = null;
  showCameraSelector = false;

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    await this.initializeScanner();
  }

  async initializeScanner(deviceId?: string): Promise<void> {
    // Skip initialization in SSR environment
    if (!this.isBrowser || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      this.isInitializing = false;
      this.errorMessage = 'Camera access not available in this environment.';
      return;
    }

    try {
      this.isInitializing = true;
      this.errorMessage = null;
      // Reset retry count if this is not a retry
      if (!deviceId || deviceId === this.currentDeviceId) {
        this.retryCount = 0;
      }

      const zxing = await import('@zxing/library');
      const { BrowserMultiFormatReader, NotFoundException } = zxing;

      // Stop current scanning if active
      if (this.reader && this.scanning) {
        try {
          this.reader.reset();
          this.reader.stopAsyncDecode();
        } catch (err) {
          // Ignore reset errors
        }
        this.scanning = false;
      }

      // Create reader - BrowserMultiFormatReader automatically supports QR codes
      this.reader = new BrowserMultiFormatReader();

      // Clean up any existing video element ID to avoid conflicts
      if (this.videoElement?.nativeElement) {
        const existingVideo = this.videoElement.nativeElement;
        if (existingVideo.id) {
          existingVideo.id = '';
        }
        // Stop any existing video tracks
        if (existingVideo.srcObject) {
          const stream = existingVideo.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          existingVideo.srcObject = null;
        }
      }

      this.reader = new BrowserMultiFormatReader();

      // Get available video input devices
      const videoInputDevices = await this.reader.listVideoInputDevices();

      if (videoInputDevices.length === 0) {
        throw new Error('No camera devices found');
      }

      // Store available cameras for selection
      this.availableCameras = videoInputDevices.map((device: any) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.substring(0, 8)}`
      }));

      // Determine which camera to use
      let selectedDeviceId: string;
      if (deviceId) {
        // Use the provided device ID
        selectedDeviceId = deviceId;
      } else if (this.selectedCameraId) {
        // Use previously selected camera
        selectedDeviceId = this.selectedCameraId;
      } else {
        // Auto-select: prefer back camera, then front camera, then first available
        const backCamera = videoInputDevices.find((device: any) =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear')
        );
        const frontCamera = videoInputDevices.find((device: any) =>
          device.label.toLowerCase().includes('front') ||
          device.label.toLowerCase().includes('facing')
        );
        selectedDeviceId = backCamera?.deviceId || frontCamera?.deviceId || videoInputDevices[0].deviceId;
      }

      this.selectedCameraId = selectedDeviceId;
      this.currentDeviceId = selectedDeviceId;

      // Wait for video element to be available
      await new Promise<void>((resolve) => {
        const checkVideo = (): void => {
          if (this.videoElement?.nativeElement) {
            resolve();
          } else {
            setTimeout(checkVideo, 50);
          }
        };
        checkVideo();
      });

      const videoElement = this.videoElement!.nativeElement;
      const videoElementId = `qr-video-${Math.random().toString(36).slice(2)}`;
      
      // Set the ID and ensure video attributes are correct
      videoElement.id = videoElementId;
      videoElement.setAttribute('autoplay', 'true');
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('muted', 'true'); // Muted helps with autoplay
      
      // Ensure video is visible and ready
      videoElement.style.display = 'block';
      videoElement.style.width = '100%';
      videoElement.style.height = 'auto';

      // Ensure the element is in the DOM and accessible via getElementById
      // ZXing uses getElementById internally, so we need to ensure it's ready
      await new Promise<void>((resolve) => {
        const checkElement = (attempts = 0): void => {
          // Use requestAnimationFrame to ensure DOM is updated before checking
          requestAnimationFrame(() => {
            const elementById = document.getElementById(videoElementId);
            if (elementById === videoElement) {
              resolve();
            } else if (attempts < 20) {
              // Try again after a short delay
              setTimeout(() => checkElement(attempts + 1), 50);
            } else {
              // Fallback: proceed anyway if element exists and is connected to DOM
              if (videoElement.id === videoElementId && videoElement.isConnected) {
                console.warn('Element found but getElementById check failed, proceeding anyway');
                resolve();
              } else {
                // Last attempt: wait a bit more and check one more time
                setTimeout(() => {
                  const finalCheck = document.getElementById(videoElementId);
                  if (finalCheck === videoElement || (videoElement.id === videoElementId && videoElement.isConnected)) {
                    resolve();
                  } else {
                    throw new Error(`Video element with ID ${videoElementId} not found in DOM after ${attempts} attempts`);
                  }
                }, 100);
              }
            }
          });
        };
        // Start checking
        checkElement();
      });

      // Verify element exists one more time before starting
      const finalCheck = document.getElementById(videoElementId);
      if (!finalCheck && videoElement.id !== videoElementId) {
        throw new Error(`Video element with ID ${videoElementId} not found in DOM`);
      }

      // Simple function to mark camera as ready
      const markCameraReady = (): void => {
        if (this.isInitializing) {
          this.isInitializing = false;
          this.scanning = true;
          videoElement.style.display = 'block';
          videoElement.classList.remove('hidden');
          
          if (this.videoCheckInterval) {
            clearInterval(this.videoCheckInterval);
            this.videoCheckInterval = null;
          }
        }
      };

      // Set up detection for when ZXing attaches the stream
      // Use video events which fire when the stream is actually ready
      const onVideoReady = (): void => {
        markCameraReady();
      };

      videoElement.addEventListener('loadedmetadata', onVideoReady, { once: true });
      videoElement.addEventListener('canplay', onVideoReady, { once: true });
      videoElement.addEventListener('playing', onVideoReady, { once: true });
      videoElement.addEventListener('loadeddata', onVideoReady, { once: true });

      // Also poll to check for stream attachment (backup method)
      const checkForStream = (): void => {
        if (!this.isInitializing) {
          if (this.videoCheckInterval) {
            clearInterval(this.videoCheckInterval);
            this.videoCheckInterval = null;
          }
          return;
        }

        const hasStream = !!videoElement.srcObject;
        const hasDimensions = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
        
        if (hasStream && hasDimensions) {
          markCameraReady();
        }
      };

      // Start checking after a short delay to let ZXing start
      setTimeout(() => {
        if (this.videoCheckInterval) {
          clearInterval(this.videoCheckInterval);
        }
        this.videoCheckInterval = setInterval(checkForStream, 100);
      }, 300);
      
      // Safety timeout - mark as ready if stream exists after 3 seconds
      setTimeout(() => {
        if (this.isInitializing && videoElement.srcObject) {
          markCameraReady();
        }
      }, 3000);

      // Callback function for handling scan results
      const handleScanResult = (result: any, err: any): void => {
          if (result) {
            const decodedText = result.getText();
            
            // Only emit if it's a new result
            if (this.lastResult !== decodedText) {
              this.lastResult = decodedText;
              this.hasScanSuccess = true;
              this.scanned.emit(decodedText);

              // Briefly flash the success state
              setTimeout(() => {
                this.hasScanSuccess = false;
              }, 800);
            }
          }

          if (err) {
            // NotFoundException is expected when no QR code is found
            // Don't emit error for this as it happens frequently during scanning
            const errorName = err?.name || err?.constructor?.name || '';
            const errorMessage = String(err?.message || '');
            
            // Ignore expected "not found" errors that occur during normal scanning
            const isExpectedError = 
              errorName === 'NotFoundException' ||
              errorName === 'NoQRCodeFoundException' ||
              errorMessage.includes('No QR code') ||
              errorMessage.includes('not found') ||
              errorMessage.includes('NotFoundException') ||
              (errorMessage.includes('element with id') && errorMessage.includes('not found')) ||
              errorMessage.includes('No MultiFormat Readers') ||
              errorMessage.includes('unable to detect');
            
            if (!isExpectedError && !this.errorMessage) {
              // Only emit actual unexpected errors
              this.errorMessage = errorMessage || 'Scan error';
              this.scanError.emit(this.errorMessage || undefined);
            }
          }
        };

      // Start decoding from video device - let ZXing handle the stream attachment
      let decodePromise: Promise<any>;
      
      if ((this.reader as any).decodeFromConstraints) {
        // Use decodeFromConstraints with optimized video constraints
        const videoConstraints: MediaTrackConstraints = {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        };
        
        decodePromise = this.reader.decodeFromConstraints(
          { video: videoConstraints },
          videoElementId,
          handleScanResult
        );
      } else {
        // Fall back to decodeFromVideoDevice (standard method)
        decodePromise = this.reader.decodeFromVideoDevice(
          selectedDeviceId,
          videoElementId,
          handleScanResult
        );
      }

      // Video is already ready at this point (we set isInitializing = false above)
      // Now start ZXing decoding from the video element

      decodePromise.catch((err: any) => {
        // Handle initialization errors
        const errorMessage = err?.message || 'Failed to start camera scanner.';
        console.error('Scanner initialization error', err);
        
        // Check if it's the "element not found" error and retry once
        if (errorMessage.includes('element with id') && errorMessage.includes('not found') && this.retryCount < this.MAX_RETRIES) {
          this.retryCount++;
          console.warn(`Element not found error, retrying initialization (attempt ${this.retryCount}/${this.MAX_RETRIES})...`);
          // Retry after a short delay
          setTimeout(() => {
            this.initializeScanner(deviceId || this.selectedCameraId || undefined).catch((retryErr: any) => {
              this.isInitializing = false;
              this.errorMessage = retryErr?.message || 'Failed to start camera scanner after retry.';
              this.scanError.emit(this.errorMessage || undefined);
            });
          }, 300);
          return;
        }
        
        this.isInitializing = false;
        this.errorMessage = errorMessage;
        this.scanError.emit(this.errorMessage || undefined);
      });
    } catch (err: any) {
      console.error('Failed to initialize QR scanner', err);
      this.isInitializing = false;
      this.errorMessage = err?.message || 'Unable to initialize camera scanner.';
      this.scanError.emit(this.errorMessage || undefined);
    }
  }

  async switchCamera(deviceId: string): Promise<void> {
    if (deviceId === this.currentDeviceId) {
      return; // Already using this camera
    }
    
    this.selectedCameraId = deviceId;
    this.showCameraSelector = false; // Close selector after selection
    await this.initializeScanner(deviceId);
  }

  toggleCameraSelector(): void {
    this.showCameraSelector = !this.showCameraSelector;
  }

  ngOnDestroy(): void {
    this.scanning = false;
    this.isInitializing = false;

    // Clear video check interval
    if (this.videoCheckInterval) {
      clearInterval(this.videoCheckInterval);
      this.videoCheckInterval = null;
    }

    if (this.reader) {
      try {
        this.reader.reset();
        this.reader.stopAsyncDecode();
      } catch (err) {
        // Ignore reset errors
      }
      this.reader = null;
    }

    // Stop video tracks
    if (this.videoElement?.nativeElement?.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.nativeElement.srcObject = null;
    }
  }
}

