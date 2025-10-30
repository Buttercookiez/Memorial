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
  const [darkMode, setDarkMode] = useState(false);
  const audioRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('memorialDarkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
  }, []);

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

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('memorialDarkMode', newDarkMode.toString());
  };

  const handleBirdClick = async (event) => {
    const newCount = birdCount + 1;
    setBirdCount(newCount);
    
    const button = event.currentTarget;
    const bird = document.createElement('div');
    bird.textContent = '🕊️';
    bird.className = 'floating-bird';
    bird.style.left = `${Math.random() * 100}%`;
    button.querySelector('.bird-float-container').appendChild(bird);
    
    setTimeout(() => bird.remove(), 2000);
    
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

    try {
      const QRCode = (await import('qrcode')).default;
      const url = window.location.href;
      
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      const qrImage = new Image();
      qrImage.src = qrDataUrl;
      
      await new Promise((resolve) => {
        qrImage.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 600;
      canvas.height = 800;

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Memorial', canvas.width / 2, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = '32px Arial';
      const name = memorial.name || 'In Loving Memory';
      ctx.fillText(name, canvas.width / 2, 160);

      ctx.fillStyle = '#cccccc';
      ctx.font = '20px Arial';
      const birthDate = formatDate(memorial.birth_date);
      const deathDate = formatDate(memorial.death_date);
      ctx.fillText(`${birthDate} — ${deathDate}`, canvas.width / 2, 200);

      ctx.fillStyle = '#ffffff';
      const qrSize = 280;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 250;
      const padding = 20;
      ctx.fillRect(qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2);
      
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#ffffff';
      ctx.font = '22px Arial';
      ctx.fillText('Scan to View Memorial', canvas.width / 2, 600);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(150, 630);
      ctx.lineTo(450, 630);
      ctx.stroke();

      ctx.fillStyle = '#999999';
      ctx.font = 'italic 18px Arial';
      ctx.fillText('Forever in our hearts', canvas.width / 2, 680);

      ctx.fillStyle = '#ffffff';
      ctx.font = '36px Arial';
      ctx.fillText('🕊️', canvas.width / 2, 730);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${memorial.name || 'memorial'}-qr-card.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Error generating QR card:', error);
      alert('Error generating QR card. Please try again.');
    }
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
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'}`}>
        <div className={`${darkMode ? 'text-neutral-500' : 'text-neutral-400'} text-sm`}>Loading memorial...</div>
      </div>
    );
  }

  if (!memorial) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'}`}>
        <div className={`${darkMode ? 'text-neutral-500' : 'text-neutral-400'} text-sm`}>Memorial not found.</div>
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
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      id: "gallery", 
      label: "Gallery", 
      shortLabel: "Gallery",
      icon: (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )
    }
  ].filter(tab => tab.show !== false);

  return (
    <>
      <div className={`min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'} flex items-center justify-center p-2 sm:p-4`}>
        <button
          onClick={toggleDarkMode}
          className={`fixed bottom-4 right-4 z-50 p-2.5 rounded-lg ${darkMode ? 'bg-white text-black' : 'bg-black text-white'} transition-all hover:scale-105`}
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className={`w-full max-w-2xl ${darkMode ? 'bg-neutral-900 shadow-2xl shadow-black/50' : 'bg-white shadow-lg'} rounded-2xl sm:rounded-3xl ${darkMode ? 'border border-neutral-800' : 'border border-neutral-200'} overflow-hidden`}>
          
          {/* Header Section */}
          <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-950 to-neutral-900' : 'bg-gradient-to-br from-neutral-800 to-neutral-900'} p-4 sm:p-8 pb-4 sm:pb-6`}>
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

          {/* Tab Navigation - Optimized for Mobile */}
          <div className={`border-b ${darkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'} overflow-x-auto scrollbar-hide`}>
            <div className="flex min-w-max sm:justify-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2.5 sm:py-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? darkMode 
                        ? "text-white border-b-2 border-white" 
                        : "text-neutral-900 border-b-2 border-neutral-900"
                      : darkMode
                        ? "text-neutral-500 hover:text-neutral-300"
                        : "text-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  <span className={`flex-shrink-0 ${activeTab === tab.id ? (darkMode ? "text-white" : "text-neutral-900") : (darkMode ? "text-neutral-500" : "text-neutral-400")}`}>
                    {tab.icon}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className={`p-4 sm:p-8 min-h-[300px] ${darkMode ? 'bg-neutral-900' : 'bg-white'}`}>
            {activeTab === "bio" && (
              <div className="space-y-6 animate-fadeIn">
                {memorial.story ? (
                  <div className="prose prose-neutral prose-sm sm:prose-base max-w-none">
                    <p className={`${darkMode ? 'text-neutral-300' : 'text-neutral-700'} leading-relaxed whitespace-pre-line`}>
                      {memorial.story}
                    </p>
                  </div>
                ) : (
                  <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
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
              <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
                <p className="text-sm">No gallery images available.</p>
              </div>
            )}

            {activeTab === "video" && videoUrl && (
              <div className="animate-fadeIn">
                <div className={`rounded-xl overflow-hidden shadow-md ${darkMode ? 'bg-neutral-950' : 'bg-neutral-100'}`}>
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
              <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
                <p className="text-sm">No video available.</p>
              </div>
            )}

            {activeTab === "music" && musicUrl && (
              <div className="animate-fadeIn space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 mb-3">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className={`text-2xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                    In Loving Memory
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    A song that echoes {memorial.name}'s spirit
                  </p>
                </div>

                <div className={`relative rounded-2xl overflow-hidden shadow-2xl ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800' : 'bg-gradient-to-br from-white to-neutral-50 border border-neutral-200'}`}>
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px'}}></div>
                  </div>
                  
                  <div className="relative">
                    {isSpotify ? (
                      <div className="p-4">
                        <iframe
                          src={spotifyEmbed}
                          className="w-full h-80 rounded-xl"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        />
                      </div>
                    ) : (
                      <div className="p-8 space-y-6">
                        <div className="flex items-center justify-center gap-1 h-24">
                          {[...Array(40)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 rounded-full ${darkMode ? 'bg-neutral-700' : 'bg-neutral-300'} transition-all`}
                              style={{
                                height: `${20 + Math.random() * 60}%`,
                                animationName: 'pulse',
                                animationDuration: `${0.5 + Math.random()}s`,
                                animationTimingFunction: 'ease-in-out',
                                animationIterationCount: 'infinite',
                                animationDelay: `${i * 0.05}s`
                              }}
                            />
                          ))}
                        </div>
                        
                        <div className="space-y-4">
                          <audio 
                            ref={audioRef}
                            controls 
                            className="w-full"
                            style={{
                              filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
                            }}
                            src={musicUrl}
                          >
                            Your browser does not support the audio element.
                          </audio>
                          
                          <div className={`text-center pt-4 border-t ${darkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
                            <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} italic`}>
                              "Music gives a soul to the universe, wings to the mind, flight to the imagination, and life to everything."
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "music" && !musicUrl && (
              <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
                <p className="text-sm">No music available.</p>
              </div>
            )}

            {activeTab === "tributes" && (
              <div className="animate-fadeIn">
                <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
                  <svg className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 ${darkMode ? 'text-neutral-600' : 'text-neutral-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <p className={`mb-2 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'} text-sm`}>Tributes section coming soon</p>
                  <p className={`text-xs ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Share your memories and condolences
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* QR Code and Share Section */}
          <div className={`p-4 sm:p-6 border-t ${darkMode ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-neutral-50'}`}>
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
              <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:min-w-[240px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-sm font-semibold">Share Memorial</span>
                </button>

                <button
                  onClick={handleBirdClick}
                  className={`relative flex items-center justify-center gap-3 px-6 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-600 hover:border-neutral-500' : 'bg-white border-neutral-200 hover:border-neutral-400'} rounded-xl border-2 hover:shadow-xl transition-all transform hover:scale-105 group w-full sm:min-w-[240px] overflow-hidden`}
                >
                  <span className="text-xl group-hover:scale-110 transition-transform duration-300">🕊️</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-neutral-800'}`}>{birdCount}</span>
                    <span className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'} font-medium`}>Birds of Farewell</span>
                  </div>
                  <div className="bird-float-container"></div>
                </button>

                <button
                  onClick={downloadQRCode}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:min-w-[240px]"
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
          
          @keyframes floatUp {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-100px) scale(1.5);
            }
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scaleY(1);
            }
            50% {
              transform: scaleY(0.5);
            }
          }
          
          .bird-float-container {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
          }
          
          .floating-bird {
            position: absolute;
            bottom: 50%;
            font-size: 1.5rem;
            animation: floatUp 2s ease-out forwards;
            pointer-events: none;
          }

          /* Hide scrollbar for mobile navigation */
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
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