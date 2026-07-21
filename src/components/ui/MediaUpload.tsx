'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MediaUploadProps {
  bucket: 'carnet-media' | 'gear-photos' | 'user-documents';
  folder?: string;
  onUploadComplete: (url: string, fileName: string) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  className?: string;
}

export default function MediaUpload({
  bucket,
  folder = '',
  onUploadComplete,
  accept = 'image/*',
  maxSizeMB = 10,
  label = 'Ajouter une photo',
  className = '',
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`Fichier trop volumineux (max ${maxSizeMB} Mo)`);
        return;
      }

      // Preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      }

      setUploading(true);
      setProgress(10);

      try {
        const ext = file.name.split('.').pop();
        const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + 15, 85));
        }, 200);

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, { upsert: false });

        clearInterval(progressInterval);

        if (uploadError) {
          setError(uploadError.message);
          setUploading(false);
          setProgress(0);
          return;
        }

        setProgress(100);

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
        onUploadComplete(urlData.publicUrl, fileName);

        setTimeout(() => {
          setUploading(false);
          setProgress(0);
        }, 600);
      } catch {
        setError('Erreur lors de l\'upload');
        setUploading(false);
        setProgress(0);
      }
    },
    [bucket, folder, maxSizeMB, onUploadComplete, supabase]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
          uploading
            ? 'border-[#E4501C]/50 bg-[#E4501C]/5 cursor-not-allowed'
            : 'border-[#C8C3B0] hover:border-[#E4501C]/50 hover:bg-[#E4501C]/5 bg-[#F5F2E8]'
        }`}
      >
        {preview && !uploading ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Aperçu" className="w-full max-h-48 object-cover rounded-xl mb-3" />
            <p className="text-xs text-[#5C6B5E]">Cliquer pour changer</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-[#E4501C]/10 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E4501C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-600 text-[#1C2620] mb-1">{label}</p>
            <p className="text-xs text-[#5C6B5E]">Glisser-déposer ou cliquer · Max {maxSizeMB} Mo</p>
          </>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[#C8C3B0] rounded-b-2xl overflow-hidden">
            <div
              className="h-full bg-[#E4501C] transition-all duration-300 rounded-b-2xl"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
      />
    </div>
  );
}
