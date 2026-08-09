"use client";

import { useRef, useState } from "react";

type Props = {
  onFile: (file: File | null) => void;
};

export default function PhotoCapture({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  function onSelect(file: File | null) {
    onFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setCameraOn(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "passport.jpg", { type: "image/jpeg" });
      onSelect(file);
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-sm border border-[var(--line)] px-3 py-2 text-sm"
          onClick={() => inputRef.current?.click()}
        >
          Upload photo
        </button>
        {!cameraOn ? (
          <button
            type="button"
            className="rounded-sm border border-[var(--line)] px-3 py-2 text-sm"
            onClick={startCamera}
          >
            Use camera
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={snap}>
              Snap
            </button>
            <button
              type="button"
              className="rounded-sm border border-[var(--line)] px-3 py-2 text-sm"
              onClick={stopCamera}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {cameraOn ? (
        <video ref={videoRef} autoPlay playsInline className="h-40 w-40 object-cover" />
      ) : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Preview" className="h-28 w-28 object-cover" />
      ) : null}
    </div>
  );
}
