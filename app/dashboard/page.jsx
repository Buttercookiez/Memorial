"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [memorials, setMemorials] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    birth_date: "",
    death_date: "",
    cause_of_death: "",
    story: "",
    profile_image: null,
    gallery_images: [],
    video_file: null,
    music_file: null,
  });

  // Store existing file URLs when editing
  const [existingFiles, setExistingFiles] = useState({
    profile_image_file: null,
    gallery_files: [],
    video_file: null,
    music_file: null,
  });
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  
  // Tribute states
  const [tributes, setTributes] = useState([]);
  const [selectedTribute, setSelectedTribute] = useState(null);
  const [envelopeOpened, setEnvelopeOpened] = useState(false);
  const [showTributesSection, setShowTributesSection] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('dashboardDarkMode');
    if (savedDarkMode === 'true') {
      setDarkMode(true);
    }
    checkAuth();
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('dashboardDarkMode', newDarkMode.toString());
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUser(user);
    fetchMemorials(user.id);
  };

  const fetchMemorials = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("memorials")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error fetching memorials:", error);
    } else {
      setMemorials(data || []);
    }
    setLoading(false);
  };

  const fetchTributes = async (memorialId) => {
    try {
      const { data, error } = await supabase
        .from("tributes")
        .select("*")
        .eq("memorial_id", memorialId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tributes:", error);
        return;
      }

      setTributes(data || []);
    } catch (error) {
      console.error("Unexpected error fetching tributes:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setFormData(prev => ({ ...prev, profile_image: file }));
    } else {
      alert("Please upload PNG or JPEG files only");
    }
  };

  const handleGalleryImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      file.type === "image/png" || file.type === "image/jpeg"
    );
    
    if (validFiles.length !== files.length) {
      alert("Some files were skipped. Please upload PNG or JPEG files only");
    }
    
    setFormData(prev => ({ 
      ...prev, 
      gallery_images: [...prev.gallery_images, ...validFiles] 
    }));
  };

  const removeGalleryImage = (index) => {
    setFormData(prev => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index)
    }));
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setFormData(prev => ({ ...prev, video_file: file }));
    } else {
      alert("Please upload a valid video file");
    }
  };

  const handleMusicChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setFormData(prev => ({ ...prev, music_file: file }));
    } else {
      alert("Please upload a valid audio file");
    }
  };

  const uploadFile = async (file, bucket, path) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      console.error(`Upload error for ${bucket}:`, uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const deleteFileFromStorage = async (fileUrl) => {
    if (!fileUrl) return;
    
    try {
      let bucket, filePath;
      
      if (fileUrl.includes('supabase.co/storage/v1/object/public/')) {
        const url = new URL(fileUrl);
        const pathParts = url.pathname.split('/');
        const publicIndex = pathParts.indexOf('public');
        
        if (publicIndex !== -1 && pathParts.length > publicIndex + 2) {
          bucket = pathParts[publicIndex + 1];
          filePath = pathParts.slice(publicIndex + 2).join('/');
        }
      }
      
      if (!bucket || !filePath) {
        console.error("Could not extract bucket or file path from URL");
        return;
      }
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);
      
      if (error) {
        console.error("Error deleting file from storage:", error);
      }
    } catch (error) {
      console.error("Error in deleteFileFromStorage:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      birth_date: "",
      death_date: "",
      cause_of_death: "",
      story: "",
      profile_image: null,
      gallery_images: [],
      video_file: null,
      music_file: null,
    });
    setExistingFiles({
      profile_image_file: null,
      gallery_files: [],
      video_file: null,
      music_file: null,
    });
    setIsCreating(false);
    setEditingId(null);
    setTributes([]);
    setShowTributesSection(false);
  };

  const generateQRCode = async (memorialId) => {
    try {
      const url = `${window.location.origin}/memorials/${memorialId}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      return qrDataUrl;
    } catch (error) {
      console.error("Error generating QR code:", error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.birth_date || !formData.death_date) {
      alert("Please fill in required fields: Name, Birth Date, and Death Date");
      return;
    }

    setSaving(true);
    setUploading(true);

    try {
      let profileImageUrl = existingFiles.profile_image_file;
      let galleryUrls = [...existingFiles.gallery_files];
      let videoUrl = existingFiles.video_file;
      let musicUrl = existingFiles.music_file;

      if (formData.profile_image) {
        if (existingFiles.profile_image_file) {
          await deleteFileFromStorage(existingFiles.profile_image_file);
        }
        profileImageUrl = await uploadFile(
          formData.profile_image, 
          'memorial-images', 
          `${user.id}/profile`
        );
      }

      if (formData.gallery_images.length > 0) {
        const uploadPromises = formData.gallery_images.map(file =>
          uploadFile(file, 'memorial-images', `${user.id}/gallery`)
        );
        const newGalleryUrls = await Promise.all(uploadPromises);
        galleryUrls = [...galleryUrls, ...newGalleryUrls];
      }

      if (formData.video_file) {
        if (existingFiles.video_file) {
          await deleteFileFromStorage(existingFiles.video_file);
        }
        videoUrl = await uploadFile(
          formData.video_file,
          'memorial-videos',
          `${user.id}/videos`
        );
      }

      if (formData.music_file) {
        if (existingFiles.music_file) {
          await deleteFileFromStorage(existingFiles.music_file);
        }
        musicUrl = await uploadFile(
          formData.music_file,
          'memorial-audio',
          `${user.id}/audio`
        );
      }

      const memorialData = {
        name: formData.name,
        birth_date: formData.birth_date,
        death_date: formData.death_date,
        cause_of_death: formData.cause_of_death,
        story: formData.story,
        profile_image_file: profileImageUrl,
        gallery_files: galleryUrls,
        video_file: videoUrl,
        music_file: musicUrl,
      };

      if (editingId) {
        const { error } = await supabase
          .from("memorials")
          .update(memorialData)
          .eq("id", editingId);

        if (error) throw error;
        alert("Memorial updated successfully!");
      } else {
        const { data: newMemorial, error } = await supabase
          .from("memorials")
          .insert([{ 
            ...memorialData,
            user_id: user.id,
            bird_count: 0 
          }])
          .select()
          .single();

        if (error) throw error;

        const qrCode = await generateQRCode(newMemorial.id);
        
        if (qrCode) {
          await supabase
            .from("memorials")
            .update({ qr_link: qrCode })
            .eq("id", newMemorial.id);
        }

        alert("Memorial created successfully!");
      }

      await fetchMemorials(user.id);
      resetForm();
    } catch (error) {
      console.error("Error saving memorial:", error);
      alert("Error saving memorial. Please try again.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleEdit = async (memorial) => {
    setFormData({
      name: memorial.name || "",
      birth_date: memorial.birth_date || "",
      death_date: memorial.death_date || "",
      cause_of_death: memorial.cause_of_death || "",
      story: memorial.story || "",
      profile_image: null,
      gallery_images: [],
      video_file: null,
      music_file: null,
    });
    
    setExistingFiles({
      profile_image_file: memorial.profile_image_file,
      gallery_files: memorial.gallery_files || [],
      video_file: memorial.video_file,
      music_file: memorial.music_file,
    });
    
    setEditingId(memorial.id);
    setIsCreating(true);
    
    // Fetch tributes for this memorial
    await fetchTributes(memorial.id);
    setShowTributesSection(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this memorial?")) return;

    const { data: memorial } = await supabase
      .from("memorials")
      .select("*")
      .eq("id", id)
      .single();

    if (memorial) {
      if (memorial.profile_image_file) {
        await deleteFileFromStorage(memorial.profile_image_file);
      }
      if (memorial.gallery_files) {
        for (const imageUrl of memorial.gallery_files) {
          await deleteFileFromStorage(imageUrl);
        }
      }
      if (memorial.video_file) {
        await deleteFileFromStorage(memorial.video_file);
      }
      if (memorial.music_file) {
        await deleteFileFromStorage(memorial.music_file);
      }
    }

    const { error } = await supabase
      .from("memorials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting memorial:", error);
      alert("Error deleting memorial");
    } else {
      alert("Memorial deleted successfully");
      fetchMemorials(user.id);
    }
  };

  const handleDeleteTribute = async (tributeId) => {
    if (!confirm("Are you sure you want to delete this tribute?")) return;

    try {
      const { error } = await supabase
        .from("tributes")
        .delete()
        .eq("id", tributeId);

      if (error) {
        console.error("Error deleting tribute:", error);
        alert("Error deleting tribute");
        return;
      }

      setTributes(prev => prev.filter(t => t.id !== tributeId));
      setSelectedTribute(null);
      alert("Tribute deleted successfully");
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Error deleting tribute");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const downloadQR = async (memorial) => {
    try {
      const url = `${window.location.origin}/memorials/${memorial.id}`;
      
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

  const removeExistingGalleryImage = (index) => {
    const imageToRemove = existingFiles.gallery_files[index];
    setExistingFiles(prev => ({
      ...prev,
      gallery_files: prev.gallery_files.filter((_, i) => i !== index)
    }));
    deleteFileFromStorage(imageToRemove);
  };

  const openModal = (imageUrl) => {
    setSelectedImage(imageUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedImage(null);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newGalleryFiles = [...existingFiles.gallery_files];
    const draggedItem = newGalleryFiles[draggedIndex];
    newGalleryFiles.splice(draggedIndex, 1);
    newGalleryFiles.splice(dropIndex, 0, draggedItem);

    setExistingFiles(prev => ({
      ...prev,
      gallery_files: newGalleryFiles
    }));
    setDraggedIndex(null);
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
      <div className={`min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'} flex items-center justify-center`}>
        <div className={`${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-neutral-950' : 'bg-gradient-to-br from-neutral-50 to-neutral-100'}`}>
      <button
        onClick={toggleDarkMode}
        className={`fixed bottom-4 right-4 z-50 p-2.5 rounded-lg ${darkMode ? 'bg-white text-black' : 'bg-black text-white'} transition-all hover:scale-105 shadow-lg`}
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

      <nav className={`${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <svg className={`w-6 h-6 ${darkMode ? 'text-white' : 'text-neutral-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className={`text-lg font-light ${darkMode ? 'text-white' : 'text-neutral-900'}`}>Memorial</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className={`text-sm ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'} transition-colors`}
              >
                Home
              </Link>
              <button
                onClick={handleLogout}
                className={`text-sm ${darkMode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-neutral-900'} transition-colors`}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <h1 className={`text-3xl sm:text-4xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'} mb-2`}>
            Memorial Dashboard
          </h1>
          <p className={`${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Manage your memorial pages</p>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className={`mb-8 flex items-center gap-2 px-6 py-3 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-semibold">Create New Memorial</span>
          </button>
        )}

        {isCreating && (
          <div className={`mb-8 ${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} rounded-2xl shadow-lg border p-6 sm:p-8`}>
            <h2 className={`text-2xl font-light ${darkMode ? 'text-white' : 'text-neutral-900'} mb-6`}>
              {editingId ? "Edit Memorial" : "Create New Memorial"}
            </h2>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all`}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Biography / Life Story
                </label>
                <textarea
                  name="story"
                  value={formData.story}
                  onChange={handleInputChange}
                  rows={6}
                  className={`w-full px-4 py-3 ${darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'} border rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent outline-none transition-all resize-none`}
                  placeholder="Share their story, memories, and legacy..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Profile Picture (PNG/JPEG)
                </label>
                
                {formData.profile_image ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Profile Picture (click to change):</p>
                    <label className="relative group cursor-pointer block w-32">
                      <img
                        src={URL.createObjectURL(formData.profile_image)}
                        alt="New profile"
                        className={`w-32 h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border shadow-md group-hover:opacity-60 transition-opacity`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                          Change Photo
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : existingFiles.profile_image_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Profile Picture (click to change):</p>
                    <label className="relative group cursor-pointer block w-32">
                      <img
                        src={existingFiles.profile_image_file}
                        alt="Current profile"
                        className={`w-32 h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border shadow-md group-hover:opacity-60 transition-opacity`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                          Change Photo
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Profile Picture
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Gallery Photos (PNG/JPEG) - Upload Multiple
                </label>
                <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all w-full mb-4`}>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>Add Gallery Photos</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    onChange={handleGalleryImagesChange}
                    className="hidden"
                  />
                </label>
                
                {existingFiles.gallery_files.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Gallery Images (drag to reorder, click to view):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {existingFiles.gallery_files.map((imageUrl, index) => (
                        <div 
                          key={`existing-${index}`} 
                          className="relative group cursor-move"
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                          <img
                            src={imageUrl}
                            alt={`Gallery ${index + 1}`}
                            className={`w-full h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => openModal(imageUrl)}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeExistingGalleryImage(index);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className={`absolute bottom-2 left-2 ${darkMode ? 'bg-neutral-800' : 'bg-white'} rounded px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <svg className={`w-3 h-3 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {formData.gallery_images.length > 0 && (
                  <div className="mt-4">
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Gallery Images to Upload:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {formData.gallery_images.map((file, index) => (
                        <div key={`new-${index}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Gallery ${index + 1}`}
                            className={`w-full h-32 object-cover rounded-lg ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border`}
                          />
                          <button
                            onClick={() => removeGalleryImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Memorial Video (MP4, MOV, etc.)
                </label>
                
                {formData.video_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Video:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            {formData.video_file.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {(formData.video_file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <video
                        src={URL.createObjectURL(formData.video_file)}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>
                ) : existingFiles.video_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Video:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            Memorial Video
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Video file attached
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="video/*"
                            onChange={handleVideoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <video
                        src={existingFiles.video_file}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Video
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium ${darkMode ? 'text-neutral-300' : 'text-neutral-700'} mb-2`}>
                  Memorial Music (MP3, WAV, etc.)
                </label>
                
                {formData.music_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>New Music:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            {formData.music_file.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {(formData.music_file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleMusicChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <audio
                        src={URL.createObjectURL(formData.music_file)}
                        controls
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : existingFiles.music_file ? (
                  <div>
                    <p className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>Current Music:</p>
                    <div className={`relative ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-800' : 'bg-gradient-to-br from-neutral-50 to-white'} rounded-2xl p-6 shadow-lg border ${darkMode ? 'border-neutral-700' : 'border-neutral-200'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`${darkMode ? 'bg-neutral-800' : 'bg-neutral-100'} rounded-full p-4`}>
                          <svg className={`w-8 h-8 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-neutral-900'} mb-1`}>
                            Memorial Music
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Audio file attached
                          </p>
                        </div>
                        <label className="cursor-pointer">
                          <div className={`${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} px-4 py-2 rounded-lg transition-all font-medium text-sm`}>
                            Change
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleMusicChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <audio
                        src={existingFiles.music_file}
                        controls
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed ${darkMode ? 'border-neutral-700 hover:border-neutral-600' : 'border-neutral-300 hover:border-neutral-400'} rounded-xl cursor-pointer transition-all`}>
                      <svg className={`w-5 h-5 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className={`text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Choose Music
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleMusicChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {showTributesSection && tributes.length > 0 && (
                <div className={`pt-6 border-t ${darkMode ? 'border-neutral-800' : 'border-neutral-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-neutral-900'}`}>
                      Tributes ({tributes.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                    {tributes.map((tribute, index) => {
                      const isBlack = index % 2 === 0;
                      
                      return (
                        <button
                          key={tribute.id}
                          onClick={() => openTribute(tribute)}
                          className="envelope cursor-pointer flex items-center justify-center relative"
                        >
                          <div className={`envelope-icon text-3xl sm:text-4xl ${isBlack ? 'envelope-black' : 'envelope-white'}`}>
                            {isBlack ? '✉' : '✉'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 px-6 py-3 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold`}
                >
                  {saving ? (uploading ? "Uploading..." : "Saving...") : editingId ? "Update Memorial" : "Create Memorial"}
                </button>
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className={`px-6 py-3 border-2 ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-xl transition-all font-semibold`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {!isCreating && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memorials.map((memorial) => (
              <div
                key={memorial.id}
                className={`${darkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'} rounded-2xl shadow-lg border overflow-hidden hover:shadow-xl transition-all`}
              >
                <div className={`relative h-48 ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-neutral-950' : 'bg-gradient-to-br from-neutral-800 to-neutral-900'}`}>
                  {memorial.profile_image_file && (
                    <img
                      src={memorial.profile_image_file}
                      alt={memorial.name}
                      className="w-full h-full object-cover opacity-40"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      {memorial.profile_image_file && (
                        <img
                          src={memorial.profile_image_file}
                          alt={memorial.name}
                          className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-xl mx-auto mb-3"
                        />
                      )}
                      <h3 className="text-xl font-light text-white px-4">{memorial.name}</h3>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className={`flex items-center justify-between text-sm ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-4`}>
                    <span>{new Date(memorial.birth_date).getFullYear()}</span>
                    <span>—</span>
                    <span>{new Date(memorial.death_date).getFullYear()}</span>
                  </div>

                  <div className="flex justify-center gap-2 mb-4">
                    {memorial.profile_image_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Photo</span>
                    )}
                    {memorial.gallery_files && memorial.gallery_files.length > 0 && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Gallery ({memorial.gallery_files.length})</span>
                    )}
                    {memorial.video_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Video</span>
                    )}
                    {memorial.music_file && (
                      <span className={`text-xs ${darkMode ? 'bg-neutral-600 text-white' : 'bg-neutral-600 text-white'} px-2 py-1 rounded-full`}>Music</span>
                    )}
                  </div>

                  {memorial.qr_link && (
                    <div className="flex justify-center mb-4">
                      <img
                        src={memorial.qr_link}
                        alt="QR Code"
                        className={`w-32 h-32 ${darkMode ? 'border-neutral-700' : 'border-neutral-200'} border rounded-lg`}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Link
                      href={`/memorials/${memorial.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full px-4 py-2 ${darkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'} text-center rounded-lg transition-all text-sm font-semibold`}
                    >
                      View Memorial
                    </Link>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleEdit(memorial)}
                        className={`px-3 py-2 border ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-lg transition-all text-sm`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => downloadQR(memorial)}
                        className={`px-3 py-2 border ${darkMode ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'} rounded-lg transition-all text-sm`}
                      >
                        QR
                      </button>
                      <button
                        onClick={() => handleDelete(memorial.id)}
                        className={`px-3 py-2 border ${darkMode ? 'border-red-900 text-red-400 hover:bg-red-950' : 'border-red-300 text-red-600 hover:bg-red-50'} rounded-lg transition-all text-sm`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {memorials.length === 0 && !isCreating && (
          <div className="text-center py-20">
            <svg className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-neutral-700' : 'text-neutral-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className={`text-xl ${darkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-2`}>No memorials yet</h3>
            <p className={`${darkMode ? 'text-neutral-600' : 'text-neutral-400'} text-sm`}>Create your first memorial to get started</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="relative max-w-4xl max-h-full w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 z-10 hover:bg-opacity-70 transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <img
              src={selectedImage}
              alt="Gallery preview"
              className="w-full h-full object-contain max-h-[80vh] rounded-lg"
            />
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
                            In loving memory
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

                      <button
                        onClick={() => handleDeleteTribute(selectedTribute.id)}
                        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md z-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
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
  );
}