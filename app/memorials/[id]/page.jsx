"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import QRGenerator from "../../components/QRGenerator";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MemorialPage() {
  const { id } = useParams();
  const [memorial, setMemorial] = useState(null);
  const [activeTab, setActiveTab] = useState("bio");
  const [birdCount, setBirdCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const audioRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    async function fetchMemorial() {
      try {
        console.log("Fetching memorial with ID:", id);
        
        const { data, error } = await supabase
          .from("memorials")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Error fetching memorial:", error);
          return;
        }

        console.log("Fetched memorial data:", data);
        setMemorial(data);
        setBirdCount(data.bird_count || 0);
        
      } catch (error) {
        console.error("Unexpected error:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (id) fetchMemorial();
  }, [id]);

  const handleBirdClick = async () => {
    const newCount = birdCount + 1;
    setBirdCount(newCount);
    
    const { error } = await supabase
      .from("memorials")
      .update({ bird_count: newCount })
      .eq("id", id);
    
    if (error) console.error("Error updating bird count:", error);
  };

  const handleShare = async () => {
    if (!memorial) return;
    
    const shareUrl = window.location.href;
    const shareData = {
      title: `${memorial.name} - Memorial`,
      text: `In loving memory of ${memorial.name}`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  const downloadQRCode = async () => {
    if (!memorial) return;

    // Generate QR code using a library approach
    const QRCode = window.QRCode || (await import('qrcode').catch(() => null));
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size for card (600x800px for good quality)
    canvas.width = 600;
    canvas.height = 800;

    // Background - Black to Dark Gray gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add decorative border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Title "Memorial"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Memorial', canvas.width / 2, 100);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    const name = memorial.name || 'In Loving Memory';
    ctx.fillText(name, canvas.width / 2, 160);

    // Dates
    ctx.fillStyle = '#cccccc';
    ctx.font = '20px Arial';
    const birthDate = formatDate(memorial.birth_date);
    const deathDate = formatDate(memorial.death_date);
    ctx.fillText(`${birthDate} — ${deathDate}`, canvas.width / 2, 200);

    // Draw white background for QR
    ctx.fillStyle = '#ffffff';
    const qrSize = 280;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 250;
    const padding = 20;
    ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2);
    
    // Generate and draw QR code directly
    try {
      const qrCodeUrl = window.location.href;
      
      // Create a temporary canvas for QR code
      const tempCanvas = document.createElement('canvas');
      
      // Try to use the displayed QR code first
      const displayedQR = qrRef.current?.querySelector('canvas') || 
                          qrRef.current?.querySelector('img') ||
                          document.querySelector('canvas[data-qr]') ||
                          document.querySelector('[role="img"]');
      
      if (displayedQR && displayedQR.tagName === 'CANVAS') {
        // Use the displayed canvas
        ctx.drawImage(displayedQR, qrX, qrY, qrSize, qrSize);
      } else if (displayedQR && displayedQR.tagName === 'IMG') {
        // Load and draw the image
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            resolve();
          };
          img.onerror = reject;
          img.src = displayedQR.src;
        });
      } else {
        // Generate QR using simple method - draw text as fallback
        ctx.fillStyle = '#000000';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        const urlText = qrCodeUrl.length > 30 ? qrCodeUrl.substring(0, 30) + '...' : qrCodeUrl;
        ctx.fillText('QR Code', qrX + qrSize/2, qrY + qrSize/2 - 20);
        ctx.font = '10px monospace';
        ctx.fillText(urlText, qrX + qrSize/2, qrY + qrSize/2 + 20);
        ctx.fillText('Scan from screen', qrX + qrSize/2, qrY + qrSize/2 + 40);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
    }

    // "Scan to View Memorial" text
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    ctx.fillText('Scan to View Memorial', canvas.width / 2, 600);

    // Decorative line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 630);
    ctx.lineTo(450, 630);
    ctx.stroke();

    // Footer message
    ctx.fillStyle = '#999999';
    ctx.font = 'italic 18px Arial';
    ctx.fillText('Forever in our hearts', canvas.width / 2, 680);

    // Small dove/bird icon using text
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px Arial';
    ctx.fillText('🕊️', canvas.width / 2, 730);

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${memorial.name || 'memorial'}-qr-card.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[date.getMonth()];
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch (error) {
      return "Invalid date";
    }
  };

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  const navigateImage = (direction) => {
    if (!memorial?.gallery_files) return;
    
    const currentIndex = memorial.gallery_files.indexOf(selectedImage);
    let newIndex;
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % memorial.gallery_files.length;
    } else {
      newIndex = (currentIndex - 1 + memorial.gallery_files.length) % memorial.gallery_files.length;
    }
    
    setSelectedImage(memorial.gallery_files[newIndex]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
        <div className="text-neutral-400 text-sm">Loading memorial...</div>
      </div>
    );
  }

  if (!memorial) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
        <div className="text-neutral-400 text-sm">Memorial not found.</div>
      </div>
    );
  }

  const profileImageUrl = memorial.profile_image_file;
  const galleryImages = memorial.gallery_files || [];
  const videoUrl = memorial.video_file;
  const musicUrl = memorial.music_file;

  const embedUrl = videoUrl?.includes('youtube.com') || videoUrl?.includes('youtu.be')
    ? videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")
    : videoUrl;

  const isSpotify = musicUrl?.includes("spotify.com");
  const spotifyEmbed = isSpotify
    ? musicUrl.replace("open.spotify.com", "open.spotify.com/embed").replace("?si=", "?utm_source=generator&si=")
    : null;

  const tabs = [
    { 
      id: "bio", 
      label: "Biography", 
      shortLabel: "Bio",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      id: "gallery", 
      label: "Gallery", 
      shortLabel: "Gallery",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      show: galleryImages.length > 0
    },
    { 
      id: "video", 
      label: "Video", 
      shortLabel: "Video",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      show: !!videoUrl 
    },
    { 
      id: "music", 
      label: "Music", 
      shortLabel: "Music",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ),
      show: !!musicUrl 
    },
    { 
      id: "tributes", 
      label: "Tributes", 
      shortLabel: "Tributes",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )
    }
  ].filter(tab => tab.show !== false);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-neutral-200 overflow-hidden">
          
          {/* Header Section */}
          <div className="relative bg-gradient-to-br from-neutral-800 to-neutral-900 p-4 sm:p-8 pb-4 sm:pb-6">
            {profileImageUrl ? (
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="relative">
                  <img
                    src={profileImageUrl}
                    alt={memorial.name}
                    className="w-24 h-24 sm:w-36 sm:h-36 rounded-full object-cover ring-4 ring-white shadow-xl"
                    onError={(e) => {
                      console.error("Error loading profile image:", profileImageUrl);
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent"></div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-neutral-700 flex items-center justify-center ring-4 ring-white shadow-xl">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            )}
            
            <h1 className="text-2xl sm:text-4xl font-light text-white text-center mb-3 sm:mb-4 px-2">
              {memorial.name}
            </h1>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-neutral-300 text-xs sm:text-sm px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">Born</span>
                <span className="font-medium">{formatDate(memorial.birth_date)}</span>
              </div>
              <span className="hidden sm:inline text-neutral-500">—</span>
              <div className="flex items-center gap-2">
                <span className="text-xs opacity-70">Died</span>
                <span className="font-medium">{formatDate(memorial.death_date)}</span>
              </div>
            </div>
            
            {memorial.cause_of_death && (
              <div className="mt-3 sm:mt-4 text-center px-2">
                <p className="text-neutral-500 text-xs mb-1">Cause of Death</p>
                <p className="text-neutral-300 text-xs sm:text-sm bg-black/20 inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                  {memorial.cause_of_death}
                </p>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-neutral-200 bg-white">
            <div className="flex justify-center overflow-x-auto">
              <div className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? "text-neutral-900 border-b-2 border-neutral-900"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    <span className={`flex-shrink-0 ${activeTab === tab.id ? "text-neutral-900" : "text-neutral-400"}`}>
                      {tab.icon}
                    </span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-8 min-h-[300px]">
            {activeTab === "bio" && (
              <div className="space-y-6 animate-fadeIn">
                {memorial.story ? (
                  <div className="prose prose-neutral prose-sm sm:prose-base max-w-none">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                      {memorial.story}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-neutral-400 py-12">
                    <p className="text-sm">No biography available yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "gallery" && galleryImages.length > 0 && (
              <div className="animate-fadeIn">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {galleryImages.map((imageUrl, index) => (
                    <div 
                      key={index} 
                      className="aspect-square rounded-lg overflow-hidden shadow-md cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => openModal(imageUrl)}
                    >
                      <img
                        src={imageUrl}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          console.error("Error loading gallery image:", imageUrl);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "gallery" && galleryImages.length === 0 && (
              <div className="text-center text-neutral-400 py-12">
                <p className="text-sm">No gallery images available.</p>
              </div>
            )}

            {activeTab === "video" && videoUrl && (
              <div className="animate-fadeIn">
                <div className="rounded-xl overflow-hidden shadow-md bg-neutral-100">
                  {embedUrl?.includes('youtube.com/embed') ? (
                    <iframe
                      src={embedUrl}
                      title={memorial.name}
                      className="w-full aspect-video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      controls
                      className="w-full aspect-video"
                      src={videoUrl}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </div>
            )}

            {activeTab === "video" && !videoUrl && (
              <div className="text-center text-neutral-400 py-12">
                <p className="text-sm">No video available.</p>
              </div>
            )}

            {activeTab === "music" && musicUrl && (
              <div className="animate-fadeIn">
                <div className="relative">
                  <div className="absolute -top-1 sm:-top-2 left-1/2 transform -translate-x-1/2 w-[95%] h-full bg-neutral-100 rounded-xl"></div>
                  <div className="absolute -top-2 sm:-top-4 left-1/2 transform -translate-x-1/2 w-[90%] h-full bg-neutral-50 rounded-xl"></div>
                  
                  <div className="relative bg-white rounded-xl overflow-hidden shadow-xl border border-neutral-200">
                    {isSpotify ? (
                      <iframe
                        src={spotifyEmbed}
                        className="w-full h-80"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      />
                    ) : (
                      <div className="p-4 sm:p-8">
                        <audio 
                          ref={audioRef}
                          controls 
                          className="w-full"
                          src={musicUrl}
                        >
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "music" && !musicUrl && (
              <div className="text-center text-neutral-400 py-12">
                <p className="text-sm">No music available.</p>
              </div>
            )}

            {activeTab === "tributes" && (
              <div className="animate-fadeIn">
                <div className="text-center text-neutral-400 py-12">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <p className="mb-2 text-neutral-500 text-sm">Tributes section coming soon</p>
                  <p className="text-xs text-neutral-400">
                    Share your memories and condolences
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* QR Code and Share Section */}
          <div className="p-4 sm:p-6 border-t border-neutral-200 bg-neutral-50">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
                  Share Memorial
                </p>
                <div ref={qrRef} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <QRGenerator link={`/memorials/${id}`} />
                </div>
              </div>

              {/* Share Button, Bird Counter, and Download Button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[240px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-sm font-semibold">Share Memorial</span>
                </button>

                <button
                  onClick={handleBirdClick}
                  className="flex items-center gap-3 px-6 py-3 bg-white rounded-xl border-2 border-neutral-200 hover:border-neutral-400 hover:shadow-lg transition-all transform hover:scale-105 group min-w-[240px]"
                >
                  <svg className="w-5 h-5 text-neutral-600 group-hover:text-neutral-900 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10c0-3 2-5 5-5s5 2 5 5v1c0 1.5 1 2.5 2 2.5s2-1 2-2.5c0-4-3-7-7-7S5 6 5 10m0 0c-1 0-2 .5-2 1.5s1 1.5 2 1.5m14 0c1 0 2-.5 2-1.5s-1-1.5-2-1.5M12 15c-2 0-3 1-3 2s1 2 3 2 3-1 3-2-1-2-3-2z"/>
                  </svg>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-neutral-800">{birdCount}</span>
                    <span className="text-xs text-neutral-500 font-medium">Birds of Farewell</span>
                  </div>
                </button>

                <button
                  onClick={downloadQRCode}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[240px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="text-sm font-semibold">Download QR Card</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}</style>
      </div>

      {/* Gallery Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full w-full">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 z-10 hover:bg-opacity-70 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 z-10 hover:bg-opacity-70 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 z-10 hover:bg-opacity-70 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            <img
              src={selectedImage}
              alt="Gallery"
              className="w-full h-full object-contain max-h-[80vh] rounded-lg"
            />
            
            {galleryImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 rounded-full px-3 py-1 text-sm">
                {galleryImages.indexOf(selectedImage) + 1} / {galleryImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}