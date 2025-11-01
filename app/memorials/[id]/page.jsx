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
  const [musicStarted, setMusicStarted] = useState(false);
  const audioRef = useRef(null);
  const qrRef = useRef(null);
  const userInteractedRef = useRef(false);
  const musicTabAudioRef = useRef(null);
  const [tributes, setTributes] = useState([]);
  const [showTributeForm, setShowTributeForm] = useState(false);
  const [tributeForm, setTributeForm] = useState({ name: '', message: '' });
  const [selectedTribute, setSelectedTribute] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [envelopeOpened, setEnvelopeOpened] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('memorialDarkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
  }, []);

  // Enhanced user interaction handler for mobile
  useEffect(() => {
    const startMusicOnInteraction = async () => {
      if (!userInteractedRef.current && memorial?.music_file && audioRef.current) {
        userInteractedRef.current = true;
        
        try {
          audioRef.current.volume = 1.0;
          audioRef.current.muted = false;
          await audioRef.current.play();
          setMusicStarted(true);
          console.log('Music started successfully');
        } catch (error) {
          console.error('Error playing music:', error);
          setTimeout(async () => {
            try {
              await audioRef.current.play();
              setMusicStarted(true);
            } catch (retryError) {
              console.error('Retry failed:', retryError);
            }
          }, 100);
        }
      }
    };

    const events = [
      'click',
      'touchstart',
      'touchend',
      'touchmove',
      'scroll',
      'wheel',
      'keydown',
      'mousedown',
      'pointerdown',
      'gesturestart'
    ];

    events.forEach(event => {
      document.addEventListener(event, startMusicOnInteraction, {
        passive: true,
        capture: true,
        once: false
      });
      window.addEventListener(event, startMusicOnInteraction, {
        passive: true,
        capture: true,
        once: false
      });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, startMusicOnInteraction, {
          passive: true,
          capture: true
        });
        window.removeEventListener(event, startMusicOnInteraction, {
          passive: true,
          capture: true
        });
      });
    };
  }, [memorial?.music_file]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioRef.current && musicStarted) {
        audioRef.current.play().catch(error => {
          console.error('Error resuming playback:', error);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [musicStarted]);

  useEffect(() => {
    const handleFocus = () => {
      if (audioRef.current && musicStarted && audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [musicStarted]);

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

  useEffect(() => {
    async function fetchTributes() {
      try {
        const { data, error } = await supabase
          .from("tributes")
          .select("*")
          .eq("memorial_id", id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching tributes:", error);
          return;
        }

        setTributes(data || []);
      } catch (error) {
        console.error("Unexpected error fetching tributes:", error);
      }
    }
    
    if (id) fetchTributes();
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

  const handleTributeSubmit = async (e) => {
    e.preventDefault();
    if (!tributeForm.name.trim() || !tributeForm.message.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase
        .from("tributes")
        .insert([
          {
            memorial_id: id,
            name: tributeForm.name.trim(),
            message: tributeForm.message.trim(),
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error("Error submitting tribute:", error);
        alert("Error submitting tribute. Please try again.");
        return;
      }

      if (data && data[0]) {
        setTributes(prev => [data[0], ...prev]);
        setTributeForm({ name: '', message: '' });
        setShowTributeForm(false);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Error submitting tribute. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTribute = (tribute) => {
    setSelectedTribute(tribute);
    setEnvelopeOpened(false);
  };

  const closeTribute = () => {
    setSelectedTribute(null);
    setEnvelopeOpened(false);
  };

  const handleEnvelopeClick = () => {
    setEnvelopeOpened(true);
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
      {musicUrl && (
        <audio 
          ref={audioRef}
          loop
          preload="auto"
          playsInline
          src={musicUrl}
          style={{ display: 'none' }}
        />
      )}

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

          <div className={`border-b ${darkMode ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <div className="flex justify-center w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-6 py-2.5 sm:py-4 text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 sm:flex-initial ${
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
                  <span className="sm:hidden text-[10px] leading-tight">{tab.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

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
                            ref={musicTabAudioRef}
                            controls 
                            className="w-full"
                            style={{
                              filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none'
                            }}
                            src={musicUrl}
                            loop
                            playsInline
                            onPlay={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = musicTabAudioRef.current?.currentTime || 0;
                                audioRef.current.play().catch(console.error);
                              }
                              setMusicStarted(true);
                            }}
                            onPause={() => {
                              if (audioRef.current) {
                                audioRef.current.pause();
                              }
                            }}
                            onSeeked={(e) => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = e.target.currentTime;
                              }
                            }}
                            onTimeUpdate={(e) => {
                              if (audioRef.current && Math.abs(audioRef.current.currentTime - e.target.currentTime) > 0.5) {
                                audioRef.current.currentTime = e.target.currentTime;
                              }
                            }}
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
                <div className="space-y-6">
                  <div className="text-center">
                    <button
                      onClick={() => setShowTributeForm(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-lg hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-md hover:shadow-lg transform hover:scale-105 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="font-semibold">Write a Tribute</span>
                    </button>
                  </div>

                  {tributes.length > 0 ? (
                    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 gap-4 sm:gap-6 envelopes-container">
                      {tributes.map((tribute, index) => {
                        const isBlack = index % 2 === 0;
                        
                        return (
                          <button
                            key={tribute.id}
                            onClick={() => openTribute(tribute)}
                            className="envelope cursor-pointer flex items-center justify-center"
                          >
                            <div className={`envelope-icon text-5xl sm:text-6xl ${isBlack ? 'envelope-black' : 'envelope-white'}`}>
                              {isBlack ? '✉' : '✉'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`text-center ${darkMode ? 'text-neutral-500' : 'text-neutral-400'} py-12`}>
                      <svg className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 ${darkMode ? 'text-neutral-600' : 'text-neutral-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <p className={`mb-2 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'} text-sm`}>No tributes yet</p>
                      <p className={`text-xs ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Be the first to share your memories
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`p-4 sm:p-6 border-t ${darkMode ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-neutral-50'}`}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
                  Share Memorial
                </p>
                <div ref={qrRef} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <QRGenerator link={`/memorials/${id}`} />
                </div>
              </div>

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

          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          .envelope {
            filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.2));
            transition: transform 0.3s ease;
          }

          .envelope:hover {
            transform: rotate(-5deg);
          }

          .envelope-icon {
            filter: grayscale(100%) contrast(1.2);
          }

          .envelope-black .envelope-icon {
            filter: grayscale(100%) brightness(0.4) contrast(1.5);
          }

          .envelope-white .envelope-icon {
            filter: ${darkMode ? 'grayscale(100%) brightness(1.3) contrast(1.2)' : 'grayscale(100%) brightness(2.5) contrast(1.5)'};
          }

          @keyframes envelopeFlapOpen {
            0% {
              transform: perspective(1000px) rotateX(0deg);
            }
            100% {
              transform: perspective(1000px) rotateX(-180deg);
            }
          }

          @keyframes envelopeSlide {
            0% {
              transform: rotate(0deg) scale(1) translateY(0);
              opacity: 1;
            }
            100% {
              transform: rotate(-8deg) scale(0.65) translateY(100px) translateX(-50px);
              opacity: 0.6;
            }
          }

          @keyframes letterSlideUp {
            0% {
              transform: translateY(120%) scale(0.9);
              opacity: 0;
            }
            60% {
              transform: translateY(-10px) scale(1.02);
              opacity: 1;
            }
            100% {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }

          @keyframes fadeInScale {
            0% {
              transform: scale(0.9);
              opacity: 0;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          .envelope-modal-closed {
            animation: fadeInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }

          .envelope-opening .envelope-flap {
            animation: envelopeFlapOpen 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            transform-origin: top center;
          }

          .envelope-opening .envelope-body {
            animation: envelopeSlide 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }

          .letter-sliding-out {
            animation: letterSlideUp 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s forwards;
            opacity: 0;
          }
        `}</style>
      </div>

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

      {showTributeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className={`relative max-w-lg w-full ${darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'} rounded-2xl border-2 shadow-2xl`}>
            <button
              onClick={() => setShowTributeForm(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className={`text-2xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                  Share Your Tribute
                </h3>
                <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-500'} mt-2`}>
                  Write a message to honor {memorial?.name}
                </p>
              </div>

              <form onSubmit={handleTributeSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={tributeForm.name}
                    onChange={(e) => setTributeForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500' : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400'} focus:outline-none focus:ring-2 focus:ring-neutral-500`}
                    placeholder="Enter your name"
                    required
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                    Your Message
                  </label>
                  <textarea
                    value={tributeForm.message}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n');
                      if (lines.length <= 10) {
                        setTributeForm(prev => ({ ...prev, message: e.target.value }));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500' : 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400'} focus:outline-none focus:ring-2 focus:ring-neutral-500 resize-none`}
                    placeholder="Share your memories, condolences, or thoughts..."
                    rows={6}
                    required
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      {tributeForm.message.split('\n').length}/10 lines
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      {tributeForm.message.length}/500 characters
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTributeForm(false)}
                    className={`flex-1 px-6 py-3 rounded-xl border-2 ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} font-semibold transition-all`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl hover:from-neutral-800 hover:to-neutral-700 transition-all shadow-lg hover:shadow-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Tribute'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {selectedTribute && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={closeTribute}>
          <div className="relative w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeTribute}
              className="absolute -top-12 right-0 text-white hover:text-neutral-300 transition-colors z-50"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative flex items-center justify-center min-h-[600px]">
              {!envelopeOpened && (
                <button
                  onClick={handleEnvelopeClick}
                  className="envelope-modal-closed cursor-pointer hover:scale-105 transition-transform duration-300"
                >
                  <div className="relative">
                    <div className="relative w-80 h-56 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 rounded-lg shadow-2xl border-2 border-neutral-600">
                      <div 
                        className="absolute top-0 left-0 right-0 bg-gradient-to-br from-neutral-700 via-neutral-600 to-neutral-800 shadow-lg z-10"
                        style={{ 
                          height: '140px',
                          clipPath: 'polygon(0 0, 50% 70%, 100% 0)',
                          borderBottom: '2px solid rgba(0,0,0,0.3)'
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-lg border border-white/20">
                          <p className="text-white text-sm font-semibold">Click to Open</p>
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 text-white/60 text-xs">
                        <p className="truncate">From: {selectedTribute.name}</p>
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {envelopeOpened && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`envelope-opening absolute`} style={{ zIndex: 1 }}>
                    <div className="envelope-body relative">
                      <div className="relative w-80 h-56 bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 rounded-lg shadow-2xl border-2 border-neutral-600">
                        <div 
                          className="envelope-flap absolute top-0 left-0 right-0 bg-gradient-to-br from-neutral-700 via-neutral-600 to-neutral-800 shadow-lg z-10"
                          style={{ 
                            height: '140px',
                            clipPath: 'polygon(0 0, 50% 70%, 100% 0)',
                            transformOrigin: 'top center'
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>
                        </div>

                        <div className="absolute inset-0 flex items-end justify-center pb-4">
                          <div className="w-4/5 h-3/4 bg-amber-100 rounded-t-lg border-2 border-amber-200"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  

                  <div className="letter-sliding-out relative" style={{ zIndex: 2 }}>
                    <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 rounded-xl shadow-2xl overflow-hidden border-4 border-amber-200 w-full max-w-2xl" style={{ minHeight: '500px' }}>
                      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
                        backgroundImage: `
                          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(139, 69, 19, 0.03) 2px, rgba(139, 69, 19, 0.03) 4px),
                          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(139, 69, 19, 0.03) 2px, rgba(139, 69, 19, 0.03) 4px),
                          radial-gradient(circle at 20% 30%, rgba(160, 82, 45, 0.1) 0%, transparent 50%),
                          radial-gradient(circle at 80% 70%, rgba(139, 69, 19, 0.1) 0%, transparent 50%)
                        `,
                        backgroundBlendMode: 'multiply'
                      }}></div>

                      <div className="absolute top-10 right-10 w-16 h-16 rounded-full bg-amber-800 opacity-5 blur-sm"></div>
                      <div className="absolute bottom-20 left-10 w-12 h-12 rounded-full bg-amber-900 opacity-5 blur-sm"></div>
                      
                      <div className="relative p-8 sm:p-12 border-b-2 border-amber-300/50">
                        <div className="text-center space-y-3">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-600"></div>
                            <svg className="w-8 h-8 text-amber-700" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                            <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-600"></div>
                          </div>
                          
                          <h3 className="text-3xl font-serif text-amber-950 tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
                            A Tribute
                          </h3>
                          <p className="text-sm text-amber-800 italic font-serif">
                            In loving memory of {memorial?.name}
                          </p>
                          
                          <div className="flex items-center justify-center gap-2 mt-4">
                            <div className="h-px w-24 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
                          </div>
                        </div>
                      </div>

                      <div className="relative p-8 sm:p-12 space-y-8">
                        <div className="space-y-6">
                          <div className="flex items-start gap-3 pb-4 border-b border-amber-300/30">
                            <span className="text-amber-800 font-serif text-lg italic">From:</span>
                            <span className="text-amber-950 font-semibold text-lg font-serif">{selectedTribute.name}</span>
                          </div>
                          
                          <div className="space-y-4">
                            <p className="text-amber-950 leading-relaxed font-serif text-base sm:text-lg whitespace-pre-wrap break-words indent-8" style={{ 
                              fontFamily: 'Georgia, serif',
                              textAlign: 'justify',
                              lineHeight: '1.8',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              hyphens: 'auto'
                            }}>
                              {selectedTribute.message}
                            </p>
                          </div>
                        </div>

                        <div className="pt-8 mt-8 border-t border-amber-300/30">
                          <div className="flex justify-between items-end">
                            <div className="text-amber-700 italic text-xs font-serif">
                              With heartfelt condolences
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-amber-700 italic font-serif mb-1">
                                {new Date(selectedTribute.created_at).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                              <div className="h-px w-32 bg-amber-800/30 ml-auto"></div>
                            </div>
                          </div>
                        </div>

                        <div className="absolute top-6 left-6 text-amber-400 opacity-30">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" opacity="0.3" />
                            <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                          </svg>
                        </div>
                        <div className="absolute bottom-6 right-6 text-amber-400 opacity-30">
                          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" opacity="0.5" />
                          </svg>
                        </div>
                      </div>

                      <div className="absolute inset-0 pointer-events-none border-2 border-amber-900/10 rounded-xl"></div>
                      <div className="absolute inset-0 pointer-events-none" style={{
                        boxShadow: 'inset 0 0 60px rgba(139, 69, 19, 0.1), inset 0 0 20px rgba(160, 82, 45, 0.05)'
                      }}></div>

                      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-30">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-800 via-red-900 to-red-950 shadow-2xl flex items-center justify-center border-4 border-red-950 relative">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-700/30 to-transparent"></div>
                            <span className="text-red-200 text-xl relative z-10">🕊️</span>
                            <div className="absolute inset-2 rounded-full border border-red-700/50"></div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-2 bg-red-950 rounded-b-full opacity-70"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}