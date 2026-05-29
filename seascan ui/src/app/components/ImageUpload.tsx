import { Upload, Image as ImageIcon, CheckCircle, Loader2, FolderOpen, FileArchive } from 'lucide-react';
import { useState, useRef } from 'react';
import { fetchWithRetry } from '../utils/network';
import { buildApiUrl } from '../utils/apiBase';

export default function ImageUpload({ onPredictionComplete }: { onPredictionComplete?: (data: any) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith('.tiff') || f.name.endsWith('.tif') || f.name.endsWith('.zip')
      );
      if (files.length > 0) {
        handleFiles(files);
      } else {
        setStatusMessage('Please drop a .zip file or .tiff images.');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => 
        f.name.toLowerCase().endsWith('.tiff') || 
        f.name.toLowerCase().endsWith('.tif') || 
        f.name.toLowerCase().endsWith('.zip')
      );
      
      if (files.length > 0) {
        handleFiles(files);
      } else {
        setStatusMessage('Please select valid .tiff files or a .zip archive.');
      }
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploadedFiles(files);
    setIsUploading(true);
    setStatusMessage('Extracting geospatial metadata...');

    try {
      // First, extract metadata from the primary file
      const metadataFormData = new FormData();
      metadataFormData.append('file', files[0]); // Use first file to extract metadata
      
      let metadata = null;
      try {
        const metadataResponse = await fetchWithRetry(buildApiUrl('/metadata'), {
          method: 'POST',
          body: metadataFormData,
        });
        
        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          metadata = metadataData.metadata;
          console.log('Extracted Metadata:', metadata);
        }
      } catch (err) {
        console.warn('Metadata extraction failed, continuing without metadata:', err);
      }

      setStatusMessage('Running classification...');

      // Now send to prediction endpoint
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetchWithRetry(buildApiUrl('/predict'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('Prediction Response:', data);
      
      // Attach metadata to response
      if (metadata) {
        data.metadata = metadata;
      }
      
      setStatusMessage('Classification complete!');
      if (onPredictionComplete) {
        onPredictionComplete(data);
      }
    } catch (error) {
      console.error('Error during upload:', error);
      setStatusMessage('Error uploading files. Check console.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-[#010812] border border-[#00C9A7]/30 rounded-2xl p-6 h-full">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
          Image Upload
        </h3>
        <p className="text-[#00C9A7]/70 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>
          ImageLoader | load_sentinel2(), validate_bands()
        </p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? 'border-[#00C9A7] bg-[#00C9A7]/20' : 'border-[#00C9A7]/30 hover:border-[#00C9A7]/60 bg-[#00C9A7]/5'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          onChange={handleFileInput} 
          className="hidden" 
          accept=".tiff,.tif,.zip"
        />
        <input 
          type="file" 
          ref={folderInputRef} 
          onChange={handleFileInput} 
          className="hidden" 
          // @ts-ignore - webkitdirectory is non-standard but works in all modern browsers
          webkitdirectory="true"
          directory="true"
        />
        {isUploading ? (
          <Loader2 className="w-12 h-12 text-[#00C9A7] mx-auto mb-4 animate-spin" />
        ) : (
          <Upload className="w-12 h-12 text-[#00C9A7] mx-auto mb-4" />
        )}
        <p className="text-white font-medium mb-1">
          {isUploading ? 'Processing upload...' : 'Drop ZIP or Sentinel-2 TIFF files here'}
        </p>
        <p className="text-gray-400 text-sm mb-6">or click a button to browse</p>
        
        <div className="flex flex-wrap justify-center gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-[#00C9A7]/20 border border-[#00C9A7] text-[#00C9A7] rounded-lg font-medium hover:bg-[#00C9A7]/30 transition-colors"
            disabled={isUploading}
          >
            <FileArchive className="w-4 h-4" />
            Select Files / ZIP
          </button>
          
          <button 
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-[#00C9A7] text-[#020D1A] rounded-lg font-medium hover:bg-[#00C9A7]/90 transition-colors"
            disabled={isUploading}
          >
            <FolderOpen className="w-4 h-4" />
            Select Folder
          </button>
        </div>
        
        {statusMessage && <p className="text-sm mt-4 text-[#3DDC84]">{statusMessage}</p>}
      </div>

      <div className="mt-6 space-y-3">
        {uploadedFiles.map((file, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-[#3DDC84]/10 border border-[#3DDC84]/30 rounded-lg">
            <ImageIcon className="w-5 h-5 text-[#3DDC84]" />
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{file.name}</p>
              <p className="text-gray-400 text-xs" style={{ fontFamily: 'Space Mono, monospace' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-[#3DDC84] animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 text-[#3DDC84]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
