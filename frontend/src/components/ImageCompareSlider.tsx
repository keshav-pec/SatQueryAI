"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";

export default function ImageCompareSlider() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", () => setIsDragging(false));
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", () => setIsDragging(false));
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", () => setIsDragging(false));
    };
  }, [isDragging]);

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-xl shadow-2xl select-none cursor-ew-resize"
      ref={containerRef}
      style={{ aspectRatio: "16 / 10", touchAction: "none" }}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* Base Image (After) */}
      <Image
        src="/test_samples/forest_after.jpg"
        alt="After Change"
        fill
        style={{ objectFit: "cover" }}
        draggable={false}
        priority
      />
      
      {/* Overlay Image (Before) */}
      <div 
        className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <Image
          src="/test_samples/forest_before.jpg"
          alt="Before Change"
          fill
          style={{ objectFit: "cover", width: "100%", height: "100%", maxWidth: "none" }}
          draggable={false}
          priority
        />
      </div>

      {/* Slider Line and Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white flex items-center justify-center shadow-lg"
        style={{ left: `calc(${sliderPosition}% - 2px)` }}
      >
        <div className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center pointer-events-none text-gray-800">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-mr-1">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-180 -ml-1">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
      </div>
      
      <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded text-sm font-semibold backdrop-blur-sm pointer-events-none">
        Before (2010)
      </div>
      <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1.5 rounded text-sm font-semibold backdrop-blur-sm pointer-events-none">
        After (2020)
      </div>
    </div>
  );
}
